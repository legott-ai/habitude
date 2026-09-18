// Cloud transport abstraction.
//
// The sync engine and coordinator talk to ONE interface; two backends
// implement it:
//
//   - MockCloudTransport: in-memory auth + Firestore-shaped store. The
//     DEFAULT backend — no Firebase project, no Stripe keys, no network.
//   - FirebaseCloudTransport: the real Firebase SDK (lazy dynamic imports,
//     same as before). Chosen only when the user flips cloudUseMock off AND
//     completes the Firebase web config.
//
// Because everything above this layer is backend-agnostic, switching from
// mock to real is a config change, not a code change.

import type { FirebaseApp } from 'firebase/app';
import type { CloudUser } from './auth';
import type { Entitlement } from './types';
import type { CloudDailyLogDoc, CloudHabitDoc } from './types';
import type { FirebaseWebConfig } from './config';

export type { CloudUser, Entitlement };

/** The contract both backends implement. */
export interface CloudTransport {
	// --- auth ---
	signUp(email: string, password: string): Promise<CloudUser>;
	signIn(email: string, password: string): Promise<CloudUser>;
	signOut(): Promise<void>;
	onAuthStateChanged(cb: (user: CloudUser | null) => void): () => void;
	// --- entitlement ---
	fetchEntitlement(uid: string): Promise<Entitlement>;
	// --- firestore-shaped docs ---
	getHabitDoc(uid: string, habitId: string): Promise<CloudHabitDoc | null>;
	setHabitDoc(uid: string, habitId: string, doc: CloudHabitDoc): Promise<void>;
	listHabitDocs(uid: string): Promise<Map<string, CloudHabitDoc>>;
	getDailyLog(uid: string, day: string): Promise<CloudDailyLogDoc | null>;
	setDailyLog(uid: string, day: string, doc: CloudDailyLogDoc): Promise<void>;
}

// ---------------------------------------------------------------------------
// Mock backend (default): in-memory, zero network.
// ---------------------------------------------------------------------------

interface MockAccount {
	uid: string;
	email: string;
	password: string;
	entitlement: Entitlement;
}

function mockPremiumEntitlement(): Entitlement {
	return {
		plan: 'premium',
		status: 'active',
		stripeCustomerId: 'cus_mock_123',
		currentPeriodEnd: new Date(Date.now() + 30 * 86400_000).toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

export function mockFreeEntitlement(): Entitlement {
	return {
		plan: 'free',
		status: 'incomplete',
		stripeCustomerId: null,
		currentPeriodEnd: null,
		updatedAt: new Date().toISOString(),
	};
}

/** In-memory auth + Firestore. One instance is shared per plugin lifetime. */
export class MockCloudTransport implements CloudTransport {
	private accounts = new Map<string, MockAccount>();
	private current: CloudUser | null = null;
	private listeners = new Set<(u: CloudUser | null) => void>();
	private habits = new Map<string, CloudHabitDoc>();
	private dailyLogs = new Map<string, CloudDailyLogDoc>();
	private uidSeq = 1;

	private notify(): void {
		for (const cb of this.listeners) cb(this.current);
	}

	private key(uid: string, ...rest: string[]): string {
		return [uid, ...rest].join('/');
	}

	async signUp(email: string, password: string): Promise<CloudUser> {
		const e = email.trim().toLowerCase();
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
			throw Object.assign(new Error('That email address looks invalid.'), {
				code: 'auth/invalid-email',
			});
		}
		if (this.accounts.has(e)) {
			throw Object.assign(new Error('That email is already registered. Try signing in.'), {
				code: 'auth/email-already-in-use',
			});
		}
		if (password.length < 6) {
			throw Object.assign(new Error('That password is too weak (min 6 characters).'), {
				code: 'auth/weak-password',
			});
		}
		const uid = `mock-uid-${this.uidSeq++}`;
		this.accounts.set(e, {
			uid,
			email: e,
			password,
			entitlement: mockPremiumEntitlement(),
		});
		this.current = { uid, email: e };
		this.notify();
		return this.current;
	}

	async signIn(email: string, password: string): Promise<CloudUser> {
		const e = email.trim().toLowerCase();
		const acct = this.accounts.get(e);
		if (!acct) {
			throw Object.assign(new Error('Wrong email or password.'), {
				code: 'auth/user-not-found',
			});
		}
		if (acct.password !== password) {
			throw Object.assign(new Error('Wrong email or password.'), {
				code: 'auth/wrong-password',
			});
		}
		this.current = { uid: acct.uid, email: acct.email };
		this.notify();
		return this.current;
	}

	async signOut(): Promise<void> {
		this.current = null;
		this.notify();
	}

	/** Convenience for tests/dev; the coordinator tracks the user itself. */
	getCurrentUser(): CloudUser | null {
		return this.current;
	}

	onAuthStateChanged(cb: (user: CloudUser | null) => void): () => void {
		this.listeners.add(cb);
		cb(this.current);
		return () => {
			this.listeners.delete(cb);
		};
	}

	async fetchEntitlement(uid: string): Promise<Entitlement> {
		for (const acct of this.accounts.values()) {
			if (acct.uid === uid) return { ...acct.entitlement };
		}
		return mockFreeEntitlement();
	}

	/** Test/dev helper: change a user's entitlement (e.g. downgrade to free). */
	setEntitlement(uid: string, ent: Entitlement): void {
		for (const acct of this.accounts.values()) {
			if (acct.uid === uid) {
				acct.entitlement = { ...ent };
				return;
			}
		}
	}

	async getHabitDoc(uid: string, habitId: string): Promise<CloudHabitDoc | null> {
		return this.habits.get(this.key(uid, 'habits', habitId)) ?? null;
	}

	async setHabitDoc(uid: string, habitId: string, doc: CloudHabitDoc): Promise<void> {
		this.habits.set(this.key(uid, 'habits', habitId), { ...doc });
	}

	async listHabitDocs(uid: string): Promise<Map<string, CloudHabitDoc>> {
		const out = new Map<string, CloudHabitDoc>();
		const prefix = this.key(uid, 'habits') + '/';
		for (const [k, v] of this.habits) {
			if (k.startsWith(prefix)) out.set(k.slice(prefix.length), { ...v });
		}
		return out;
	}

	async getDailyLog(uid: string, day: string): Promise<CloudDailyLogDoc | null> {
		const d = this.dailyLogs.get(this.key(uid, 'dailyLogs', day));
		return d ? { checks: { ...d.checks }, updatedAt: d.updatedAt } : null;
	}

	async setDailyLog(uid: string, day: string, doc: CloudDailyLogDoc): Promise<void> {
		this.dailyLogs.set(this.key(uid, 'dailyLogs', day), {
			checks: { ...doc.checks },
			updatedAt: doc.updatedAt,
		});
	}
}

// ---------------------------------------------------------------------------
// Real Firebase backend (opt-in via cloudUseMock=false + complete config).
// ---------------------------------------------------------------------------

export class FirebaseCloudTransport implements CloudTransport {
	constructor(
		private appPromise: Promise<FirebaseApp>,
		private config: FirebaseWebConfig,
	) {}

	/** Build a Firebase-backed transport from a validated web config. */
	static async create(config: FirebaseWebConfig): Promise<FirebaseCloudTransport> {
		const { getFirebaseApp } = await import('./firebase');
		return new FirebaseCloudTransport(getFirebaseApp(config), config);
	}

	private async authModule() {
		const { getAuth } = await import('firebase/auth');
		return getAuth(await this.appPromise);
	}

	async signUp(email: string, password: string): Promise<CloudUser> {
		const { cloudSignUp } = await import('./auth');
		return cloudSignUp(await this.appPromise, email, password);
	}

	async signIn(email: string, password: string): Promise<CloudUser> {
		const { cloudSignIn } = await import('./auth');
		return cloudSignIn(await this.appPromise, email, password);
	}

	async signOut(): Promise<void> {
		const { cloudSignOut } = await import('./auth');
		return cloudSignOut(await this.appPromise);
	}

	/** Extra (not on the interface): read the Firebase current user. */
	async currentUser(): Promise<CloudUser | null> {
		const a = await this.authModule();
		const u = a.currentUser;
		return u ? { uid: u.uid, email: u.email } : null;
	}

	onAuthStateChanged(cb: (user: CloudUser | null) => void): () => void {
		let unsub: (() => void) | null = null;
		void (async () => {
			const { onCloudAuthStateChanged } = await import('./auth');
			unsub = await onCloudAuthStateChanged(await this.appPromise, cb);
		})();
		return () => {
			unsub?.();
		};
	}

	async fetchEntitlement(uid: string): Promise<Entitlement> {
		const { fetchEntitlement } = await import('./entitlement');
		return fetchEntitlement(await this.appPromise, uid);
	}

	private async db() {
		const { getFirestore } = await import('firebase/firestore');
		return getFirestore(await this.appPromise);
	}

	async getHabitDoc(uid: string, habitId: string): Promise<CloudHabitDoc | null> {
		const { doc, getDoc } = await import('firebase/firestore');
		const snap = await getDoc(doc(await this.db(), 'users', uid, 'habits', habitId));
		return snap.exists() ? (snap.data() as CloudHabitDoc) : null;
	}

	async setHabitDoc(uid: string, habitId: string, docData: CloudHabitDoc): Promise<void> {
		const { doc, setDoc } = await import('firebase/firestore');
		await setDoc(doc(await this.db(), 'users', uid, 'habits', habitId), docData, {
			merge: true,
		});
	}

	async listHabitDocs(uid: string): Promise<Map<string, CloudHabitDoc>> {
		const { collection, getDocs } = await import('firebase/firestore');
		const snap = await getDocs(collection(await this.db(), 'users', uid, 'habits'));
		const out = new Map<string, CloudHabitDoc>();
		snap.forEach((d) => out.set(d.id, d.data() as CloudHabitDoc));
		return out;
	}

	async getDailyLog(uid: string, day: string): Promise<CloudDailyLogDoc | null> {
		const { doc, getDoc } = await import('firebase/firestore');
		const snap = await getDoc(doc(await this.db(), 'users', uid, 'dailyLogs', day));
		return snap.exists() ? (snap.data() as CloudDailyLogDoc) : null;
	}

	async setDailyLog(uid: string, day: string, docData: CloudDailyLogDoc): Promise<void> {
		const { doc, setDoc } = await import('firebase/firestore');
		await setDoc(doc(await this.db(), 'users', uid, 'dailyLogs', day), docData, {
			merge: true,
		});
	}
}
