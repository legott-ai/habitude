// Firestore sync engine: allowlisted payload builders, LWW merge, and the
// debounced push/pull manager.
//
// Offline-first: the local vault stays the source of truth. Local changes
// schedule a push 30s later (debounced); a manual "Sync now" command forces
// an immediate cycle. Nothing runs unless the entitlement gate passes.

import type { App } from 'obsidian';
import type { FirebaseApp } from 'firebase/app';
import type { Habit } from '../types';
import type { HabitStore } from '../store';
import { addDays, todayKey } from '../utils/dates';
import type { CloudCheckEntry, CloudDailyLogDoc, CloudHabitDoc } from './types';

/** Debounce window after local changes before a push cycle starts. */
export const SYNC_DEBOUNCE_MS = 30_000;
/** How many recent daily logs take part in each sync cycle. */
export const SYNC_LOG_WINDOW_DAYS = 120;
/** Remote applies suppress the local-change hook for this long (echo guard). */
const APPLY_SUPPRESS_MS = 5_000;

/**
 * Build the habit payload from an explicit field allowlist. Extra fields on
 * the input (note text, paths, anything else) are dropped — they can never
 * reach the wire. This is what the allowlist test pins down.
 */
export function buildHabitPayload(habit: Habit, updatedAt: string): CloudHabitDoc {
	return {
		title: habit.title,
		schedule: habit.schedule,
		createdAt: habit.created,
		archived: habit.archived,
		updatedAt,
	};
}

export interface LocalCheckInput {
	habitId: string;
	done: boolean;
	updatedAt: string;
}

/** Build the daily-log payload; entry fields are allowlisted too. */
export function buildDailyLogPayload(
	entries: LocalCheckInput[],
	deviceId: string,
	logUpdatedAt: string,
): CloudDailyLogDoc {
	const checks: Record<string, CloudCheckEntry> = {};
	for (const e of entries) {
		checks[e.habitId] = { done: e.done, updatedAt: e.updatedAt, deviceId };
	}
	return { checks, updatedAt: logUpdatedAt };
}

/**
 * Last-write-wins per check. Ties on updatedAt break by deviceId
 * (lexicographically greater wins) so two devices converge deterministically.
 */
export function mergeCheckEntry(
	local: CloudCheckEntry | null | undefined,
	remote: CloudCheckEntry | null | undefined,
): CloudCheckEntry | null {
	if (!local) return remote ?? null;
	if (!remote) return local;
	if (remote.updatedAt > local.updatedAt) return remote;
	if (local.updatedAt > remote.updatedAt) return local;
	return remote.deviceId >= local.deviceId ? remote : local;
}

/** Merge two check maps entry-by-entry with mergeCheckEntry. */
export function mergeDailyLogChecks(
	local: Record<string, CloudCheckEntry>,
	remote: Record<string, CloudCheckEntry>,
): Record<string, CloudCheckEntry> {
	const out: Record<string, CloudCheckEntry> = {};
	for (const id of new Set([...Object.keys(local), ...Object.keys(remote)])) {
		const merged = mergeCheckEntry(local[id], remote[id]);
		if (merged) out[id] = merged;
	}
	return out;
}

export type HabitSyncDecision = 'push' | 'pull' | 'in-sync';

/**
 * Decide the direction for one habit doc. Local edits are stamped with the
 * Habits.md mtime; remote wins only when it is newer than BOTH our last
 * sync and our local state.
 */
export function decideHabitSync(
	localUpdatedAt: string,
	remote: CloudHabitDoc | null | undefined,
	lastSyncAt: string,
): HabitSyncDecision {
	if (!remote) return 'push';
	if (remote.updatedAt > lastSyncAt && remote.updatedAt > localUpdatedAt) return 'pull';
	if (localUpdatedAt > remote.updatedAt) return 'push';
	return 'in-sync';
}

function recentDateKeys(n: number): string[] {
	const out: string[] = [];
	const t = todayKey();
	for (let i = 0; i < n; i++) out.push(addDays(t, -i));
	return out;
}

export interface SyncDeps {
	app: App;
	store: HabitStore;
	uid: string;
	deviceId: string;
	getLastSyncAt: () => string;
	setLastSyncAt: (iso: string) => Promise<void>;
	onError: (message: string) => void;
	onCycle?: (info: { pushed: number; pulled: number }) => void;
}

export class CloudSyncManager {
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private syncing = false;
	private suppressUntil = 0;
	private disposed = false;

	constructor(
		private firebaseApp: FirebaseApp,
		private deps: SyncDeps,
	) {}

	/** Called on every local change; debounced into a push cycle. */
	markLocalChange(): void {
		if (this.disposed || Date.now() < this.suppressUntil) return;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			void this.cycle().catch((e) => this.deps.onError(e instanceof Error ? e.message : String(e)));
		}, SYNC_DEBOUNCE_MS);
	}

	/** Manual sync (command / settings button): immediate cycle. */
	async syncNow(): Promise<{ pushed: number; pulled: number }> {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		return this.cycle();
	}

	dispose(): void {
		this.disposed = true;
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	private async cycle(): Promise<{ pushed: number; pulled: number }> {
		if (this.syncing || this.disposed) return { pushed: 0, pulled: 0 };
		this.syncing = true;
		try {
			const { getFirestore, doc, setDoc, getDoc, getDocs, collection } = await import('firebase/firestore');
			const db = getFirestore(this.firebaseApp);
			const { store, uid, deviceId } = this.deps;
			const now = new Date().toISOString();
			const lastSyncAt = this.deps.getLastSyncAt();
			let pushed = 0;
			let pulled = 0;

			// 1. Push habits (allowlisted payload only).
			const habits = await store.loadAllHabits();
			const localHabitsAt = new Date(await store.getHabitsMtime()).toISOString();
			for (const h of habits) {
				const ref = doc(db, 'users', uid, 'habits', h.id);
				const snap = await getDoc(ref);
				const remote = snap.exists() ? (snap.data() as CloudHabitDoc) : null;
				if (decideHabitSync(localHabitsAt, remote, lastSyncAt) !== 'pull') {
					await setDoc(ref, buildHabitPayload(h, now), { merge: true });
					pushed++;
				}
			}

			// 2. Pull habits: adopt unknown remote habits, pull newer ones.
			const remoteHabits = new Map<string, CloudHabitDoc>();
			const habitsSnap = await getDocs(collection(db, 'users', uid, 'habits'));
			habitsSnap.forEach((d) => remoteHabits.set(d.id, d.data() as CloudHabitDoc));
			const byId = new Map(habits.map((h) => [h.id, h]));
			this.suppressUntil = Date.now() + APPLY_SUPPRESS_MS;
			for (const [id, rh] of remoteHabits) {
				const lh = byId.get(id);
				if (!lh) {
					await store.upsertHabit({
						id,
						title: rh.title,
						created: rh.createdAt.slice(0, 10),
						schedule: 'daily',
						archived: rh.archived,
					});
					pulled++;
				} else if (
					decideHabitSync(localHabitsAt, rh, lastSyncAt) === 'pull' &&
					(lh.title !== rh.title || lh.archived !== rh.archived)
				) {
					await store.upsertHabit({ ...lh, title: rh.title, archived: rh.archived });
					pulled++;
				}
			}

			// 3. Daily logs: merge per check (LWW), apply locally, push merged.
			const titleById = new Map<string, string>();
			for (const h of await store.loadAllHabits()) titleById.set(h.id, h.title);
			for (const [id, rh] of remoteHabits) {
				if (!titleById.has(id)) titleById.set(id, rh.title);
			}
			for (const day of recentDateKeys(SYNC_LOG_WINDOW_DAYS)) {
				const localChecks = await store.loadDayChecks(day);
				const localAt = new Date(await store.getDayLogMtime(day)).toISOString();
				// Local entries are check-only (the log format stores checked
				// ids; an uncheck is "no entry" stamped with the file mtime).
				const localRec: Record<string, CloudCheckEntry> = {};
				for (const id of localChecks) {
					localRec[id] = { done: true, updatedAt: localAt, deviceId };
				}
				const ref = doc(db, 'users', uid, 'dailyLogs', day);
				const snap = await getDoc(ref);
				const remoteDoc: CloudDailyLogDoc | null = snap.exists() ? (snap.data() as CloudDailyLogDoc) : null;
				const merged = mergeDailyLogChecks(localRec, remoteDoc?.checks ?? {});
				// Apply to the vault only where the merged result differs.
				for (const [id, entry] of Object.entries(merged)) {
					const localHas = localChecks.has(id);
					if (entry.done !== localHas) {
						await store.setCheck(day, id, titleById.get(id) ?? id, entry.done);
						pulled++;
					}
				}
				// Push the merged doc unless the remote already matches.
				const remoteChecks = remoteDoc?.checks;
				if (!remoteChecks || JSON.stringify(merged) !== JSON.stringify(remoteChecks)) {
					await setDoc(ref, { checks: merged, updatedAt: now } satisfies CloudDailyLogDoc, {
						merge: true,
					});
					pushed++;
				}
			}

			await this.deps.setLastSyncAt(now);
			this.suppressUntil = Date.now() + APPLY_SUPPRESS_MS;
			this.deps.onCycle?.({ pushed, pulled });
			return { pushed, pulled };
		} finally {
			this.syncing = false;
		}
	}
}
