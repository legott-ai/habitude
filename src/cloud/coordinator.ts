// Cloud coordinator: owns the lazy Firebase lifecycle for the plugin.
//
// Cheap to create (no network, no Firebase bytes). The SDK is touched only
// inside ensureReady()/signIn(), i.e. after the user enables cloud sync with
// a complete config. main.ts creates/disposes this in reconcileCloud().

import type { FirebaseApp } from 'firebase/app';
import type HabitudePlugin from '../main';
import { getFirebaseApp } from './firebase';
import { ensureDeviceId, getFirebaseWebConfig, validateFirebaseWebConfig } from './config';
import { cloudAuthErrorMessage, cloudSignIn, cloudSignOut, cloudSignUp, onCloudAuthStateChanged, type CloudUser } from './auth';
import { canEnableCloudSync, fetchEntitlement, type Entitlement } from './entitlement';
import { CloudSyncManager } from './sync';

export type CloudStatus =
	| 'disabled'
	| 'needs-config'
	| 'signed-out'
	| 'not-premium'
	| 'ready'
	| 'error';

/** Entitlement is re-fetched at most this often. */
const ENTITLEMENT_CACHE_MS = 15 * 60 * 1000;

export class CloudCoordinator {
	private app: FirebaseApp | null = null;
	private user: CloudUser | null = null;
	private authUnsub: (() => void) | null = null;
	private manager: CloudSyncManager | null = null;
	private entitlement: Entitlement | null = null;
	private entitlementAt = 0;
	private lastError: string | null = null;

	private constructor(private plugin: HabitudePlugin) {}

	static create(plugin: HabitudePlugin): CloudCoordinator {
		return new CloudCoordinator(plugin);
	}

	/** Best-effort status from cached state (no network). */
	getStatus(): CloudStatus {
		if (!this.plugin.settings.cloudEnabled) return 'disabled';
		if (validateFirebaseWebConfig(this.plugin.settings).length > 0) return 'needs-config';
		if (this.lastError && !this.user) return 'error';
		if (!this.user) return 'signed-out';
		if (!canEnableCloudSync(this.entitlement)) return 'not-premium';
		return 'ready';
	}

	getLastError(): string | null {
		return this.lastError;
	}

	getCurrentUserEmail(): string | null {
		return this.user?.email ?? null;
	}

	getEntitlement(): Entitlement | null {
		return this.entitlement;
	}

	/** Forward a local change into the debounced sync (no-op unless ready). */
	markLocalChange(): void {
		this.manager?.markLocalChange();
	}

	/** Manual sync: gate first, then run an immediate cycle. */
	async syncNow(): Promise<{ pushed: number; pulled: number }> {
		if (!(await this.ensureReady())) {
			throw new Error(this.lastError ?? 'Cloud sync is not ready.');
		}
		return (await this.manager?.syncNow()) ?? { pushed: 0, pulled: 0 };
	}

	async signIn(email: string, password: string): Promise<void> {
		try {
			const app = await this.ensureApp();
			await this.ensureAuthListener();
			this.user = await cloudSignIn(app, email, password);
			this.plugin.settings.cloudEmail = email;
			await this.plugin.saveData(this.plugin.settings);
			this.lastError = null;
			await this.ensureReady();
		} catch (e) {
			this.lastError = cloudAuthErrorMessage(e);
			throw new Error(this.lastError);
		}
	}

	async signUp(email: string, password: string): Promise<void> {
		try {
			const app = await this.ensureApp();
			await this.ensureAuthListener();
			this.user = await cloudSignUp(app, email, password);
			this.plugin.settings.cloudEmail = email;
			await this.plugin.saveData(this.plugin.settings);
			this.lastError = null;
			await this.ensureReady();
		} catch (e) {
			this.lastError = cloudAuthErrorMessage(e);
			throw new Error(this.lastError);
		}
	}

	async signOut(): Promise<void> {
		if (this.app) {
			try {
				await cloudSignOut(this.app);
			} catch {
				// Local state is cleared regardless.
			}
		}
		this.user = null;
		this.entitlement = null;
		this.lastError = null;
		this.manager?.dispose();
		this.manager = null;
	}

	dispose(): void {
		this.authUnsub?.();
		this.authUnsub = null;
		this.manager?.dispose();
		this.manager = null;
		this.app = null;
		this.user = null;
		this.entitlement = null;
	}

	/**
	 * Lazy gate: load Firebase, attach the auth listener, refresh the
	 * entitlement, and start the sync manager only when the account is
	 * premium-active. Returns false (with lastError set) otherwise.
	 */
	private async ensureReady(): Promise<boolean> {
		try {
			const app = await this.ensureApp();
			await this.ensureAuthListener();
			if (!this.user) {
				this.lastError = 'Sign in to enable cloud sync.';
				return false;
			}
			const now = Date.now();
			if (!this.entitlement || now - this.entitlementAt > ENTITLEMENT_CACHE_MS) {
				this.entitlement = await fetchEntitlement(app, this.user.uid);
				this.entitlementAt = now;
			}
			const ok = canEnableCloudSync(this.entitlement);
			if (ok && !this.manager) {
				const s = this.plugin.settings;
				if (!s.cloudDeviceId) {
					s.cloudDeviceId = ensureDeviceId(s);
					await this.plugin.saveData(s);
				}
				this.manager = new CloudSyncManager(app, {
					app: this.plugin.app,
					store: this.plugin.getStore(),
					uid: this.user.uid,
					deviceId: s.cloudDeviceId,
					getLastSyncAt: () => this.plugin.settings.cloudLastSyncAt,
					setLastSyncAt: async (iso) => {
						this.plugin.settings.cloudLastSyncAt = iso;
						await this.plugin.saveData(this.plugin.settings);
					},
					onError: (m) => {
						this.lastError = m;
					},
				});
				// Kick off an initial pull so a fresh device converges.
				void this.manager.syncNow().catch((e) => {
					this.lastError = e instanceof Error ? e.message : String(e);
				});
			} else if (!ok && this.manager) {
				this.manager.dispose();
				this.manager = null;
			}
			if (ok) this.lastError = null;
			else this.lastError = 'Cloud sync needs an active Premium plan.';
			return ok;
		} catch (e) {
			this.lastError = e instanceof Error ? e.message : String(e);
			return false;
		}
	}

	private async ensureApp(): Promise<FirebaseApp> {
		if (this.app) return this.app;
		const missing = validateFirebaseWebConfig(this.plugin.settings);
		if (missing.length > 0) {
			throw new Error(`Incomplete Firebase config: ${missing.join(', ')}.`);
		}
		this.app = await getFirebaseApp(getFirebaseWebConfig(this.plugin.settings));
		return this.app;
	}

	private async ensureAuthListener(): Promise<void> {
		if (this.authUnsub) return;
		const app = await this.ensureApp();
		this.authUnsub = await onCloudAuthStateChanged(app, (u) => {
			this.user = u;
			if (!u) {
				this.manager?.dispose();
				this.manager = null;
				this.entitlement = null;
			}
		});
	}
}
