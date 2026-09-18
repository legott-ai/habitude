// Cloud coordinator: owns the lazy cloud-backend lifecycle for the plugin.
//
// Cheap to create (no network, no Firebase bytes). The backend is chosen by
// settings: MockCloudTransport by default (cloudUseMock=true), the real
// Firebase transport only when the user opts into it AND completes the
// config. main.ts creates/disposes this in reconcileCloud().

import type HabitudePlugin from '../main';
import { ensureDeviceId, getFirebaseWebConfig, validateFirebaseWebConfig } from './config';
import { cloudAuthErrorMessage, type CloudUser } from './auth';
import { canEnableCloudSync, type Entitlement } from './entitlement';
import { CloudSyncManager } from './sync';
import {
	FirebaseCloudTransport,
	MockCloudTransport,
	type CloudTransport,
} from './transport';

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
	private transport: CloudTransport | null = null;
	private user: CloudUser | null = null;
	private authUnsub: (() => void) | null = null;
	private manager: CloudSyncManager | null = null;
	private entitlement: Entitlement | null = null;
	private entitlementAt = 0;
	private lastError: string | null = null;

	private constructor(
		private plugin: HabitudePlugin,
		private injectedTransport?: CloudTransport,
	) {}

	static create(plugin: HabitudePlugin, transport?: CloudTransport): CloudCoordinator {
		return new CloudCoordinator(plugin, transport);
	}

	/** Best-effort status from cached state (no network). */
	getStatus(): CloudStatus {
		if (!this.plugin.settings.cloudEnabled) return 'disabled';
		if (!this.isMock() && validateFirebaseWebConfig(this.plugin.settings).length > 0)
			return 'needs-config';
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

	/** True while the mock backend is selected (the default). */
	isMock(): boolean {
		return this.plugin.settings.cloudUseMock !== false;
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
			const t = await this.ensureTransport();
			this.user = await t.signIn(email, password);
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
			const t = await this.ensureTransport();
			this.user = await t.signUp(email, password);
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
		if (this.transport) {
			try {
				await this.transport.signOut();
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
		this.transport = null;
		this.user = null;
		this.entitlement = null;
	}

	/**
	 * Lazy gate: load the backend, attach the auth listener, refresh the
	 * entitlement, and start the sync manager only when the account is
	 * premium-active. Returns false (with lastError set) otherwise.
	 */
	private async ensureReady(): Promise<boolean> {
		try {
			const t = await this.ensureTransport();
			await this.ensureAuthListener();
			if (!this.user) {
				this.lastError = 'Sign in to enable cloud sync.';
				return false;
			}
			const now = Date.now();
			if (!this.entitlement || now - this.entitlementAt > ENTITLEMENT_CACHE_MS) {
				this.entitlement = await t.fetchEntitlement(this.user.uid);
				this.entitlementAt = now;
			}
			const ok = canEnableCloudSync(this.entitlement);
			if (ok && !this.manager) {
				const s = this.plugin.settings;
				if (!s.cloudDeviceId) {
					s.cloudDeviceId = ensureDeviceId(s);
					await this.plugin.saveData(s);
				}
				this.manager = new CloudSyncManager(t, {
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

	private async ensureTransport(): Promise<CloudTransport> {
		if (this.transport) return this.transport;
		if (this.injectedTransport) {
			this.transport = this.injectedTransport;
			return this.transport;
		}
		if (this.isMock()) {
			this.transport = new MockCloudTransport();
			return this.transport;
		}
		const missing = validateFirebaseWebConfig(this.plugin.settings);
		if (missing.length > 0) {
			throw new Error(`Incomplete Firebase config: ${missing.join(', ')}.`);
		}
		this.transport = await FirebaseCloudTransport.create(
			getFirebaseWebConfig(this.plugin.settings),
		);
		return this.transport;
	}

	private async ensureAuthListener(): Promise<void> {
		if (this.authUnsub) return;
		const t = await this.ensureTransport();
		this.authUnsub = t.onAuthStateChanged((u) => {
			this.user = u;
			if (!u) {
				this.manager?.dispose();
				this.manager = null;
				this.entitlement = null;
			}
		});
	}
}
