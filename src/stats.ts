// Streak and completion statistics computed from daily check sets.

import { addDays, todayKey } from './utils/dates';

/**
 * Consecutive checked days ending today. If today is not checked yet,
 * the streak counts back from yesterday (a habit done daily until yesterday
 * is still "alive").
 */
export function streakFor(habitId: string, checksByDay: Map<string, Set<string>>): number {
	let cursor = todayKey();
	if (!checksByDay.get(cursor)?.has(habitId)) {
		cursor = addDays(cursor, -1);
	}
	let streak = 0;
	while (checksByDay.get(cursor)?.has(habitId)) {
		streak++;
		cursor = addDays(cursor, -1);
		// bound the scan: a streak can never exceed the days we loaded
		if (streak > 370) break;
	}
	return streak;
}

/**
 * Length of a run of checked days that stopped 2 to 7 days ago, or 0. A habit
 * checked today or yesterday is still going, and an older stop is not news.
 */
export function pausedRunFor(habitId: string, checksByDay: Map<string, Set<string>>, today = todayKey()): number {
	const checked = (key: string) => checksByDay.get(key)?.has(habitId) ?? false;
	if (checked(today) || checked(addDays(today, -1))) return 0;
	for (let gap = 2; gap <= 7; gap++) {
		let cursor = addDays(today, -gap);
		if (!checked(cursor)) continue;
		let days = 0;
		while (checked(cursor) && days <= 370) {
			days++;
			cursor = addDays(cursor, -1);
		}
		return days;
	}
	return 0;
}

/** Fraction of the given week days checked (0..1). */
export function weekRateFor(habitId: string, weekKeys: string[], checksByDay: Map<string, Set<string>>): number {
	if (weekKeys.length === 0) return 0;
	let n = 0;
	for (const key of weekKeys) {
		if (checksByDay.get(key)?.has(habitId)) n++;
	}
	return n / weekKeys.length;
}

/** Keys for the 60 days ending today (used for streak scans). */
export function recentKeys(days = 60): string[] {
	const keys: string[] = [];
	for (let i = 0; i < days; i++) {
		keys.push(addDays(todayKey(), -i));
	}
	return keys;
}
