// Tests for the cloud-sync module (src/cloud/).
//
// Covers:
//   (a) payload allowlist — a habit carrying note text / vault paths /
//       filenames must serialize to a payload containing zero of them;
//   (b) last-write-wins merge per check (incl. deviceId tiebreak);
//   (c) entitlement gating — free accounts are blocked from sync;
//   (d) Firebase web-config validation + device-id generation;
//   (e) habit sync-direction decisions.
//
// Load/lazy behavior (no firebase import at plugin load when disabled) is
// covered by load-probe.ts and lazy-probe.ts (separate bundles).
//
// Build & run:
//   esbuild test/cloud/cloud-test.ts --bundle --platform=node \
//     --alias:obsidian=./test/stress/mock-obsidian.ts \
//     --outfile=test/cloud/dist/cloud-test.cjs --format=cjs --log-level=warning \
//   && node test/cloud/dist/cloud-test.cjs

import {
	buildDailyLogPayload,
	buildHabitPayload,
	decideHabitSync,
	mergeCheckEntry,
	mergeDailyLogChecks,
} from '../../src/cloud/sync';
import { ensureDeviceId, getFirebaseWebConfig, validateFirebaseWebConfig } from '../../src/cloud/config';
import { canEnableCloudSync, type Entitlement } from '../../src/cloud/entitlement';
import { DEFAULT_SETTINGS, type Habit, type PluginSettings } from '../../src/types';
import type { CloudCheckEntry, CloudHabitDoc } from '../../src/cloud/types';

let failures = 0;

function check(name: string, cond: boolean, extra = ''): void {
	if (cond) {
		console.log(`  PASS ${name}${extra}`);
	} else {
		failures++;
		console.log(`  FAIL ${name}${extra}`);
	}
}

function entry(done: boolean, updatedAt: string, deviceId: string): CloudCheckEntry {
	return { done, updatedAt, deviceId };
}

function premiumEntitlement(): Entitlement {
	return {
		plan: 'premium',
		status: 'active',
		stripeCustomerId: 'cus_123',
		currentPeriodEnd: '2026-10-18T00:00:00.000Z',
		updatedAt: '2026-09-18T00:00:00.000Z',
	};
}

function testAllowlist(): void {
	console.log('payload allowlist');
	// A habit object smuggling note content, vault paths and filenames.
	const sneaky = {
		id: 'morning-run',
		title: 'Morning run',
		created: '2026-09-18',
		schedule: 'daily',
		archived: false,
		note: 'PRIVATE journal text about my health and family',
		journalMarkdown: '# Dear diary\nvery secret stuff',
		vaultPath: 'Journal/2026/09/2026-09-18.md',
		fileName: 'secret-notes.md',
	} as unknown as Habit;
	const payload = buildHabitPayload(sneaky, '2026-09-18T12:00:00.000Z');
	const keys = Object.keys(payload).sort().join(',');
	check('habit payload has exactly the allowlisted keys', keys === 'archived,createdAt,schedule,title,updatedAt', ` [${keys}]`);
	const json = JSON.stringify(payload);
	check('habit payload contains zero note text', !json.includes('PRIVATE journal text'));
	check('habit payload contains zero journal markdown', !json.includes('Dear diary'));
	check('habit payload contains zero vault path', !json.includes('Journal/2026/09/2026-09-18.md'));
	check('habit payload contains zero filename', !json.includes('secret-notes.md'));
	check('habit payload keeps the title', payload.title === 'Morning run');

	const log = buildDailyLogPayload(
		[{ habitId: 'morning-run', done: true, updatedAt: '2026-09-18T12:00:00.000Z' }],
		'device-1',
		'2026-09-18T12:00:00.000Z',
	);
	const logKeys = Object.keys(log).sort().join(',');
	check('log payload has exactly the allowlisted keys', logKeys === 'checks,updatedAt', ` [${logKeys}]`);
	const entryKeys = Object.keys(log.checks['morning-run'] ?? {})
		.sort()
		.join(',');
	check('check entry has exactly the allowlisted keys', entryKeys === 'deviceId,done,updatedAt', ` [${entryKeys}]`);
	const logJson = JSON.stringify(log);
	check('log payload contains no habit id outside checks keys', !logJson.includes('morning-run.md'));
}

function testLwwMerge(): void {
	console.log('LWW merge');
	const t1 = '2026-09-18T10:00:00.000Z';
	const t2 = '2026-09-18T11:00:00.000Z';

	check('newer remote wins', mergeCheckEntry(entry(false, t1, 'a'), entry(true, t2, 'b'))?.done === true);
	check('newer local wins', mergeCheckEntry(entry(true, t2, 'a'), entry(false, t1, 'b'))?.done === true);
	check(
		'tie: lexicographically greater deviceId wins',
		mergeCheckEntry(entry(false, t1, 'a'), entry(true, t1, 'b'))?.done === true,
	);
	check(
		'tie reversed: still greater deviceId wins',
		mergeCheckEntry(entry(true, t1, 'b'), entry(false, t1, 'a'))?.done === true,
	);
	check(
		'tie with equal deviceId is deterministic (remote)',
		mergeCheckEntry(entry(false, t1, 'a'), entry(true, t1, 'a'))?.done === true,
	);
	const r = entry(true, t2, 'b');
	check('null local -> remote', mergeCheckEntry(null, r) === r);
	const l = entry(false, t1, 'a');
	check('null remote -> local', mergeCheckEntry(l, null) === l);
	check('null/undefined -> null', mergeCheckEntry(null, undefined) === null);

	const merged = mergeDailyLogChecks(
		{ h1: entry(true, t2, 'a'), h2: entry(true, t1, 'a') },
		{ h2: entry(false, t2, 'b'), h3: entry(true, t1, 'b') },
	);
	check('map merge keeps local-only entry', merged['h1']?.done === true);
	check('map merge applies LWW per entry', merged['h2']?.done === false && merged['h2']?.deviceId === 'b');
	check('map merge keeps remote-only entry', merged['h3']?.done === true);
	check('map merge covers the union', Object.keys(merged).sort().join(',') === 'h1,h2,h3');
}

function testEntitlementGating(): void {
	console.log('entitlement gating');
	check('free plan is blocked', !canEnableCloudSync({ ...premiumEntitlement(), plan: 'free' }));
	check('premium + active is allowed', canEnableCloudSync(premiumEntitlement()));
	check('premium + past_due is blocked', !canEnableCloudSync({ ...premiumEntitlement(), status: 'past_due' }));
	check('premium + canceled is blocked', !canEnableCloudSync({ ...premiumEntitlement(), status: 'canceled' }));
	check('premium + incomplete is blocked', !canEnableCloudSync({ ...premiumEntitlement(), status: 'incomplete' }));
	check('null entitlement is blocked', !canEnableCloudSync(null));
	check('undefined entitlement is blocked', !canEnableCloudSync(undefined));
}

function testConfig(): void {
	console.log('firebase config');
	const empty: PluginSettings = { ...DEFAULT_SETTINGS };
	const missing = validateFirebaseWebConfig(empty);
	check('empty config reports all 4 required fields', missing.length === 4, ` [${missing.join(', ')}]`);

	const partial: PluginSettings = { ...DEFAULT_SETTINGS, cloudApiKey: 'k', cloudProjectId: 'p' };
	const missing2 = validateFirebaseWebConfig(partial);
	check('partial config reports the rest', missing2.length === 2, ` [${missing2.join(', ')}]`);

	const full: PluginSettings = {
		...DEFAULT_SETTINGS,
		cloudApiKey: 'k',
		cloudAuthDomain: 'd',
		cloudProjectId: 'p',
		cloudAppId: 'a',
	};
	check('complete config passes', validateFirebaseWebConfig(full).length === 0);
	const cfg = getFirebaseWebConfig(full);
	check('optional fields omitted when empty', cfg.storageBucket === undefined && cfg.messagingSenderId === undefined);
	const withOptional: PluginSettings = { ...full, cloudStorageBucket: 'b', cloudMessagingSenderId: 's' };
	const cfg2 = getFirebaseWebConfig(withOptional);
	check('optional fields included when set', cfg2.storageBucket === 'b' && cfg2.messagingSenderId === 's');

	const s: PluginSettings = { ...DEFAULT_SETTINGS };
	const id1 = ensureDeviceId(s);
	check('device id generated', typeof id1 === 'string' && id1.length > 0);
	check('device id stable across calls', ensureDeviceId(s) === id1);
	const s2: PluginSettings = { ...DEFAULT_SETTINGS, cloudDeviceId: 'existing' };
	check('existing device id kept', ensureDeviceId(s2) === 'existing');
}

function testHabitDecisions(): void {
	console.log('habit sync decisions');
	const habit: Habit = { id: 'h', title: 'H', created: '2026-09-18', schedule: 'daily', archived: false };
	const remote = (updatedAt: string): CloudHabitDoc => buildHabitPayload(habit, updatedAt);

	check('no remote -> push', decideHabitSync('2026-09-18T10:00:00.000Z', null, '2026-09-18T09:00:00.000Z') === 'push');
	check(
		'remote newer than last sync and local -> pull',
		decideHabitSync('2026-09-18T10:00:00.000Z', remote('2026-09-18T11:00:00.000Z'), '2026-09-18T09:00:00.000Z') ===
			'pull',
	);
	check(
		'local newer than remote -> push',
		decideHabitSync('2026-09-18T12:00:00.000Z', remote('2026-09-18T11:00:00.000Z'), '2026-09-18T09:00:00.000Z') ===
			'push',
	);
	check(
		'remote newer than local but not than last sync -> in-sync',
		decideHabitSync('2026-09-18T10:00:00.000Z', remote('2026-09-18T10:30:00.000Z'), '2026-09-18T11:00:00.000Z') ===
			'in-sync',
	);
}

testAllowlist();
testLwwMerge();
testEntitlementGating();
testConfig();
testHabitDecisions();

if (failures > 0) {
	console.log(`\n${failures} FAILURE(S)`);
	process.exitCode = 1;
} else {
	console.log('\nALL CLOUD TESTS PASS');
}
