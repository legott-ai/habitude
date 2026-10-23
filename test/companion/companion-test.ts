// Build & run (no Obsidian runtime or backend needed):
//   npx esbuild test/companion/companion-test.ts --bundle --platform=node \
//     --outfile=/tmp/habitude-companion-test.cjs --format=cjs --log-level=warning
//   node /tmp/habitude-companion-test.cjs

import type { CompanionEntryPoint, CompanionIntent } from '../../src/companion';

type CompanionModule = typeof import('../../src/companion');
let failures = 0;

function check(name: string, condition: boolean): void {
	console.log(`  ${condition ? 'PASS' : 'FAIL'} ${name}`);
	if (!condition) failures++;
}

function testUrls(module: CompanionModule): void {
	console.log('Companion URL allowlist');
	const entries: CompanionEntryPoint[] = ['checklist', 'coach', 'review', 'settings', 'command'];
	const intents: CompanionIntent[] = ['explore', 'plans'];
	for (const entry of entries) {
		for (const intent of intents) {
			const url = new URL(module.buildCompanionUrl(entry, intent));
			check(`${entry}/${intent}: fixed HTTPS root`, url.origin === 'https://habitude.ai' && url.pathname === '/');
			check(`${entry}/${intent}: no fragment or credentials`, url.hash === '' && url.username === '' && url.password === '');
			check(`${entry}/${intent}: only approved fields`, [...url.searchParams.keys()].sort().join(',') === 'intent,utm_campaign,utm_content,utm_medium,utm_source');
			check(`${entry}/${intent}: attribution and intent`, url.searchParams.get('utm_source') === 'obsidian'
				&& url.searchParams.get('utm_medium') === 'plugin'
				&& url.searchParams.get('utm_campaign') === 'companion'
				&& url.searchParams.get('utm_content') === entry
				&& url.searchParams.get('intent') === intent);
		}
	}
	check('default intent is explore', new URL(module.buildCompanionUrl('command')).searchParams.get('intent') === 'explore');
	const firstLink = module.buildCompanionUrl('review', 'plans');
	const repeatedLink = module.buildCompanionUrl('review', 'plans');
	check('same input produces identical link', firstLink === repeatedLink);

	// Simulate corrupt persisted values or a JavaScript caller bypassing types.
	const secret = 'PRIVATE-Vault/therapy-note.md?email=person@example.com';
	const invalidValues: unknown[] = [undefined, null, '', 0, false, secret, 'https://attacker.example/',
		'checklist&token=private', { title: secret }, { toString: () => { throw new Error('must not coerce'); } }];
	for (const value of invalidValues) {
		const result = module.buildCompanionUrl(value as CompanionEntryPoint, value as CompanionIntent);
		check('invalid values use safe defaults without coercion', result === module.buildCompanionUrl('command', 'explore'));
		check('private input never enters URL', !result.includes('PRIVATE') && !result.includes('private') && !result.includes('attacker'));
	}
	const polluted = { entry: 'checklist', habitId: secret, pluginVersion: secret, note: secret };
	const pollutedResult: unknown = Reflect.apply(module.buildCompanionUrl, undefined, [polluted.entry, 'explore', polluted]);
	check('extra personal-data arguments ignored', pollutedResult === module.buildCompanionUrl('checklist'));
}

function testPlans(module: CompanionModule): void {
	console.log('Approved plan proposal');
	const plans = module.COMPANION_PLANS;
	const [free, sync, plus] = plans;
	check('three stable plan ids', plans.map(plan => plan.id).join(',') === 'free,sync,plus');
	check('catalog and records are immutable', Object.isFrozen(plans) && plans.every(Object.isFrozen));
	check('free local plan costs nothing', free?.name === 'Free' && free.monthlyUsd === 0 && free.annualUsd === 0);
	check('free has no cloud allocation', free?.storageGiB === 0 && free.sources === 0 && free.weightedCredits === 0);
	check('Sync monthly USD price', sync?.name === 'Sync' && sync.monthlyUsd === 2.99);
	check('Sync annual USD total', sync?.annualUsd === 29.99);
	check('Sync quota is 10 GiB and 2 sources', sync?.storageGiB === 10 && sync.sources === 2 && sync.weightedCredits === 0);
	check('Plus monthly USD price', plus?.name === 'Plus' && plus.monthlyUsd === 6.99);
	check('Plus annual USD total', plus?.annualUsd === 59.99);
	check('Plus quota is 50 GiB, 5 sources, 200 weighted credits', plus?.storageGiB === 50 && plus.sources === 5 && plus.weightedCredits === 200);
	check('annual totals are below twelve monthly payments', !!sync && !!plus && sync.annualUsd < sync.monthlyUsd * 12 && plus.annualUsd < plus.monthlyUsd * 12);
	check('paid plans are planned', sync?.status === 'planned' && plus?.status === 'planned');
	check('no plan claims checkout is possible', plans.every(plan => plan.canPurchase === false));
}

function testRecommendations(module: CompanionModule): void {
	console.log('Pure contextual recommendations');
	const recommend = module.recommendCompanion;
	check('no habits starts with setup', recommend({ habitCount: 0, weekChecks: 0 }) === 'start');
	check('first unchecked habit starts with setup', recommend({ habitCount: 1, weekChecks: 0 }) === 'start');
	check('early activity without configured coach suggests coach', recommend({ habitCount: 2, weekChecks: 3 }) === 'coach');
	check('configured coach suggests review', recommend({ habitCount: 2, weekChecks: 3, coachConfigured: true }) === 'review');
	check('seven checks suggests review', recommend({ habitCount: 1, weekChecks: 7 }) === 'review');
	check('fractional count normalized deterministically', recommend({ habitCount: 1.9, weekChecks: 6.9 }) === 'coach');
	const context = Object.freeze({ habitCount: 2, weekChecks: 9, coachConfigured: false });
	check('repeated calls have no impression state', Array.from({ length: 20 }, () => recommend(context)).every(reason => reason === 'review'));
	check('context is not mutated', JSON.stringify(context) === '{"habitCount":2,"weekChecks":9,"coachConfigured":false}');
	for (const count of [NaN, Infinity, -Infinity, -1, 0.1]) {
		check('invalid habit count safely starts with setup', recommend({ habitCount: count, weekChecks: 7 }) === 'start');
		check('invalid check count safely starts with setup', recommend({ habitCount: 1, weekChecks: count }) === 'start');
	}
	check('string counts are not coerced', recommend({ habitCount: '2' as unknown as number, weekChecks: 7 }) === 'start');
}

function testPreference(module: CompanionModule): void {
	console.log('Local promotion preference');
	check('explicit opt-out preserved', module.normalizeCompanionPrompts(false) === false);
	check('explicit opt-in preserved', module.normalizeCompanionPrompts(true) === true);
	for (const value of [undefined, null, '', 'false', 0, 1, [], {}, NaN]) {
		check('missing or malformed preference uses documented default', module.normalizeCompanionPrompts(value) === true);
	}
}

async function main(): Promise<void> {
	// Trap all browser network transports and persistent stores before import,
	// so even module initialization cannot silently contact a service or count
	// impressions. The test has no Obsidian alias or network implementation.
	const transports = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'];
	const stores = ['localStorage', 'sessionStorage'];
	const originals = new Map<string, PropertyDescriptor | undefined>();
	let networkCalls = 0;
	let storageCalls = 0;
	for (const key of [...transports, ...stores]) {
		originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
		Object.defineProperty(globalThis, key, {
			configurable: true,
			get: () => {
				if (stores.includes(key)) storageCalls++;
				else networkCalls++;
				throw new Error(`Unexpected external access: ${key}`);
			},
		});
	}
	try {
		const module = await import('../../src/companion');
		testUrls(module);
		testPlans(module);
		testRecommendations(module);
		testPreference(module);
		check('no browser network transport accessed', networkCalls === 0);
		check('no browser storage accessed', storageCalls === 0);
	} finally {
		for (const [key, original] of originals) {
			if (original) Object.defineProperty(globalThis, key, original);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
	if (failures > 0) {
		console.log(`\n${failures} companion check(s) FAILED`);
		process.exitCode = 1;
	} else {
		console.log('\nAll companion checks passed.');
	}
}

void main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
