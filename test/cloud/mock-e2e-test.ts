// Mock-backend end-to-end tests for cloud sync.
//
// Drives the REAL CloudCoordinator + CloudSyncManager against the
// MockCloudTransport (in-memory, zero network, zero Firebase config):
//
//   1. mock auth — signUp/signIn/signOut, duplicate + wrong-password errors;
//   2. two-device sync — device A pushes habits + daily checks, device B
//      pulls them; remote payloads are allowlisted (no note text, no vault
//      paths, no filenames);
//   3. coordinator E2E — signUp -> status ready -> syncNow works;
//      entitlement downgraded to free -> status not-premium -> syncNow
//      throws the Premium gate error; signOut -> signed-out.
//
// Build & run:
//   esbuild test/cloud/mock-e2e-test.ts --bundle --platform=node \
//     --alias:obsidian=./test/stress/mock-obsidian.ts \
//     --outfile=test/cloud/dist/mock-e2e-test.cjs --format=cjs --log-level=warning \
//   && node test/cloud/dist/mock-e2e-test.cjs

import type { App } from 'obsidian';
import { MockCloudTransport, mockFreeEntitlement } from '../../src/cloud/transport';
import { CloudSyncManager, type SyncDeps } from '../../src/cloud/sync';
import { CloudCoordinator } from '../../src/cloud/coordinator';
import { canEnableCloudSync } from '../../src/cloud/entitlement';
import { DEFAULT_SETTINGS, type Habit, type PluginSettings } from '../../src/types';
import type { HabitStore } from '../../src/store';
import { todayKey } from '../../src/utils/dates';
import type HabitudePlugin from '../../src/main';

let failures = 0;

function check(name: string, cond: boolean, extra = ''): void {
	if (cond) {
		console.log(`  PASS ${name}${extra}`);
	} else {
		failures++;
		console.log(`  FAIL ${name}${extra}`);
	}
}

function errCode(e: unknown): string {
	return typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : '';
}

/** Minimal in-memory HabitStore for the sync manager. */
class FakeStore {
	habits = new Map<string, Habit>();
	checks = new Map<string, Set<string>>();
	habitsMtime = Date.now();
	dayMtimes = new Map<string, number>();

	async loadAllHabits(): Promise<Habit[]> {
		return [...this.habits.values()];
	}
	async getHabitsMtime(): Promise<number> {
		return this.habitsMtime;
	}
	async upsertHabit(h: Habit): Promise<void> {
		this.habits.set(h.id, { ...h });
		this.habitsMtime = Date.now();
	}
	async loadDayChecks(day: string): Promise<Set<string>> {
		return new Set(this.checks.get(day) ?? []);
	}
	async getDayLogMtime(day: string): Promise<number> {
		return this.dayMtimes.get(day) ?? 0;
	}
	async setCheck(day: string, habitId: string, _title: string, checked: boolean): Promise<void> {
		let s = this.checks.get(day);
		if (!s) {
			s = new Set();
			this.checks.set(day, s);
		}
		if (checked) s.add(habitId);
		else s.delete(habitId);
		this.dayMtimes.set(day, Date.now());
	}
}

function asHabitStore(s: FakeStore): HabitStore {
	return s as unknown as HabitStore;
}

function depsFor(store: FakeStore, uid: string, deviceId: string): SyncDeps {
	return {
		app: {} as App,
		store: asHabitStore(store),
		uid,
		deviceId,
		getLastSyncAt: () => '',
		setLastSyncAt: async () => {},
		onError: (m) => {
			console.log(`  (sync onError: ${m})`);
		},
	};
}

function makePlugin(store: FakeStore): {
	plugin: HabitudePlugin;
	settings: PluginSettings;
} {
	const settings: PluginSettings = {
		...DEFAULT_SETTINGS,
		cloudEnabled: true,
		cloudUseMock: true,
	};
	const plugin = {
		settings,
		app: {},
		saveData: async () => {},
		getStore: () => asHabitStore(store),
	} as unknown as HabitudePlugin;
	return { plugin, settings };
}

async function testMockAuth(): Promise<void> {
	console.log('mock auth');
	const t = new MockCloudTransport();
	const u = await t.signUp('u@example.com', 'pw123456');
	check('signUp returns uid+email', u.uid.startsWith('mock-uid-') && u.email === 'u@example.com');

	let code = '';
	try {
		await t.signUp('u@example.com', 'pw123456');
	} catch (e) {
		code = errCode(e);
	}
	check('duplicate signUp rejected', code === 'auth/email-already-in-use', ` (code=${code})`);

	code = '';
	try {
		await t.signIn('u@example.com', 'wrongpw');
	} catch (e) {
		code = errCode(e);
	}
	check('wrong password rejected', code === 'auth/wrong-password', ` (code=${code})`);

	code = '';
	try {
		await t.signIn('nobody@example.com', 'pw123456');
	} catch (e) {
		code = errCode(e);
	}
	check('unknown email rejected', code === 'auth/user-not-found', ` (code=${code})`);

	const ent = await t.fetchEntitlement(u.uid);
	check('mock default entitlement is premium-active', ent.plan === 'premium' && ent.status === 'active');
	check('gate passes for mock premium', canEnableCloudSync(ent));

	t.setEntitlement(u.uid, mockFreeEntitlement());
	check('gate blocks after downgrade to free', !canEnableCloudSync(await t.fetchEntitlement(u.uid)));

	await t.signOut();
	check('signOut clears current user', t.getCurrentUser() === null);
}

async function testTwoDeviceSync(): Promise<void> {
	console.log('two-device sync via mock');
	const t = new MockCloudTransport();
	const u = await t.signUp('a@example.com', 'pw123456');

	// Device A: one habit + today's check.
	const storeA = new FakeStore();
	await storeA.upsertHabit({
		id: 'h1',
		title: 'Read',
		created: '2026-09-18',
		schedule: 'daily',
		archived: false,
	});
	const today = todayKey();
	await storeA.setCheck(today, 'h1', 'Read', true);

	const mgrA = new CloudSyncManager(t, depsFor(storeA, u.uid, 'dev-A'));
	const ra = await mgrA.syncNow();
	check('device A pushed', ra.pushed > 0, ` (pushed=${ra.pushed})`);

	// The remote habit doc carries ONLY the allowlisted fields.
	const remoteHabit = await t.getHabitDoc(u.uid, 'h1');
	check('remote habit doc exists', remoteHabit !== null);
	const keys = remoteHabit ? Object.keys(remoteHabit).sort() : [];
	check(
		'remote habit payload is allowlisted',
		JSON.stringify(keys) === JSON.stringify(['archived', 'createdAt', 'schedule', 'title', 'updatedAt']),
		` (keys=${keys.join(',')})`,
	);

	const remoteLog = await t.getDailyLog(u.uid, today);
	check('remote daily log carries the check', remoteLog?.checks['h1']?.done === true);

	// Device B: empty local state, same account, different device.
	const storeB = new FakeStore();
	const mgrB = new CloudSyncManager(t, depsFor(storeB, u.uid, 'dev-B'));
	const rb = await mgrB.syncNow();
	check('device B pulled', rb.pulled >= 1, ` (pulled=${rb.pulled})`);
	const habitsB = await storeB.loadAllHabits();
	check(
		'device B adopted the habit',
		habitsB.some((h) => h.id === 'h1' && h.title === 'Read'),
	);
	check('device B got the check', (await storeB.loadDayChecks(today)).has('h1'));
}

async function testCoordinatorE2E(): Promise<void> {
	console.log('coordinator E2E (login -> sync -> gating)');
	const t = new MockCloudTransport();
	const { plugin } = makePlugin(new FakeStore());
	const coord = CloudCoordinator.create(plugin, t);

	check('status before sign-in is signed-out', coord.getStatus() === 'signed-out');

	await coord.signUp('e2e@example.com', 'pw123456');
	check('status after sign-up is ready', coord.getStatus() === 'ready', ` (${coord.getStatus()})`);
	check('email recorded', coord.getCurrentUserEmail() === 'e2e@example.com');

	// Premium by default: syncNow must not throw.
	let threw = '';
	try {
		await coord.syncNow();
	} catch (e) {
		threw = e instanceof Error ? e.message : String(e);
	}
	check('premium syncNow works', threw === '', ` (threw=${threw})`);

	// Downgrade the entitlement: a fresh coordinator sees not-premium.
	const cu = t.getCurrentUser();
	check('mock user present', cu !== null);
	if (cu) t.setEntitlement(cu.uid, mockFreeEntitlement());
	const { plugin: plugin2 } = makePlugin(new FakeStore());
	const coord2 = CloudCoordinator.create(plugin2, t);
	await coord2.signIn('e2e@example.com', 'pw123456');
	check('free account status is not-premium', coord2.getStatus() === 'not-premium', ` (${coord2.getStatus()})`);
	threw = '';
	try {
		await coord2.syncNow();
	} catch (e) {
		threw = e instanceof Error ? e.message : String(e);
	}
	check('free account syncNow is blocked', threw.includes('Premium'), ` (threw=${threw})`);

	await coord.signOut();
	check('status after sign-out is signed-out', coord.getStatus() === 'signed-out');
}

async function main(): Promise<void> {
	await testMockAuth();
	await testTwoDeviceSync();
	await testCoordinatorE2E();
	if (failures > 0) {
		console.log(`\n${failures} FAILURES`);
		process.exit(1);
	}
	console.log('\nALL PASS');
}

void main().catch((e) => {
	console.error('FATAL', e);
	process.exit(1);
});
