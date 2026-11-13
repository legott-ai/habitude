// Tests for the checklist's "today" summary and first-run starters (src/today.ts).
//
// Build & run: npm run test:today

import { setUiLocale, t, UI_STRINGS } from '../../src/i18n';
import { STARTER_HABITS, todaySummary, topicParticle } from '../../src/today';
import { pausedRunFor } from '../../src/stats';
import { addDays } from '../../src/utils/dates';
import type { Habit } from '../../src/types';

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
	if (cond) {
		console.log(`  PASS ${name}`);
	} else {
		failures++;
		console.log(`  FAIL ${name}${extra}`);
	}
}

const habit = (id: string, title = id): Habit => ({ id, title, created: '2026-11-01', schedule: 'daily', archived: false });
const habits = [habit('walk', '산책'), habit('read', '독서'), habit('run', 'Morning run')];

console.log('today summary');
{
	const none = todaySummary(habits, undefined);
	check('nothing checked: 0 done, the first habit is next', none.done === 0 && none.total === 3 && none.next?.id === 'walk');
	const some = todaySummary(habits, new Set(['walk']));
	check('one checked: the next unchecked habit in list order', some.done === 1 && some.next?.id === 'read');
	const all = todaySummary(habits, new Set(['walk', 'read', 'run']));
	check('all checked: nothing is next', all.done === 3 && all.next === null);
	const stale = todaySummary(habits, new Set(['walk', 'archived-habit']));
	check('a check for a habit no longer listed is not counted', stale.done === 1 && stale.total === 3);
	const empty = todaySummary([], new Set(['walk']));
	check('no habits: nothing to count', empty.total === 0 && empty.done === 0 && empty.next === null);
}

console.log('topic particle');
{
	check('a final consonant takes 은', topicParticle('산책') === '은');
	check('a final vowel takes 는', topicParticle('독서') === '는' && topicParticle('일찍 자기') === '는');
	check('trailing spaces are ignored', topicParticle('산책 ') === '은');
	check('a title not ending in Hangul takes none', topicParticle('Morning run') === '' && topicParticle('') === '' && topicParticle('5km') === '');
}

console.log('strings');
{
	setUiLocale('ko');
	check('Korean question carries the particle', t('checklist.today.ask', { title: '산책', particle: topicParticle('산책') }) === '오늘 산책은 했나요?');
	check('Korean count', t('checklist.today.count', { done: 1, total: 3 }) === '오늘 3개 중 1개 완료');
	setUiLocale('en');
	check('English question ignores the particle', t('checklist.today.ask', { title: 'Walk', particle: '' }) === 'Did you do "Walk" today?');
	for (const key of ['checklist.emptyTitle', 'checklist.emptyHint', 'checklist.starterAria', 'checklist.thisWeek', 'checklist.today.count',
		'checklist.today.ask', 'checklist.today.done', 'checklist.today.allDone']) {
		check(`${key} exists in both languages`, !!UI_STRINGS.en[key] && !!UI_STRINGS.ko[key]);
	}
}

console.log('paused run');
{
	const today = '2026-11-10';
	const days = (...ago: number[]) => new Map(ago.map((n) => [addDays(today, -n), new Set(['walk'])] as const));
	check('a five-day run that stopped two days ago', pausedRunFor('walk', days(2, 3, 4, 5, 6), today) === 5);
	check('checked today: still going', pausedRunFor('walk', days(0, 2, 3, 4), today) === 0);
	check('checked yesterday: still going', pausedRunFor('walk', days(1, 2, 3, 4), today) === 0);
	check('the run is counted from the last checked day', pausedRunFor('walk', days(4, 5, 6), today) === 3);
	check('a stop more than a week old is not news', pausedRunFor('walk', days(8, 9, 10, 11), today) === 0);
	check('a gap ends the run', pausedRunFor('walk', days(2, 3, 5, 6, 7), today) === 2);
	check('another habit does not count', pausedRunFor('read', days(2, 3, 4), today) === 0);
	check('no records', pausedRunFor('walk', new Map(), today) === 0);
}

console.log('starter habits');
{
	for (const locale of ['en', 'ko'] as const) {
		const list = STARTER_HABITS[locale];
		check(`${locale}: six distinct, short titles`, list.length === 6 && new Set(list).size === 6 && list.every((title) => title.trim() === title && title.length <= 14));
	}
}

if (failures > 0) {
	console.log(`\n${failures} failure(s)`);
	process.exit(1);
}
console.log('\nAll today tests passed');
