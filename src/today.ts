// What the checklist says first: today's count and the next habit to do.
// Local arithmetic over the habits and today's checks; no AI and no network.

import type { UiLocale } from './i18n';
import type { Habit } from './types';

export interface TodaySummary {
	total: number;
	done: number;
	/** The first habit, in list order, not yet checked today. */
	next: Habit | null;
}

export function todaySummary(habits: readonly Habit[], todayChecks: ReadonlySet<string> | undefined): TodaySummary {
	const done = habits.filter((habit) => todayChecks?.has(habit.id)).length;
	const next = habits.find((habit) => !todayChecks?.has(habit.id)) ?? null;
	return { total: habits.length, done, next };
}

/** One-tap first habits for an empty checklist. */
export const STARTER_HABITS: Record<UiLocale, readonly string[]> = {
	en: ['Walk', 'Read', 'Exercise', 'Meditate', 'Sleep early', 'Drink water'],
	ko: ['산책', '독서', '운동', '명상', '일찍 자기', '물 마시기'],
};

/** Korean topic particle for a habit title: "산책은", "독서는". Empty for a title that doesn't end in Hangul. */
export function topicParticle(title: string): string {
	const code = title.trim().charCodeAt(title.trim().length - 1);
	if (!(code >= 0xac00 && code <= 0xd7a3)) return '';
	return (code - 0xac00) % 28 ? '은' : '는';
}
