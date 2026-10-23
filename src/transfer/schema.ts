import type { Habit } from '../types';

export const TRANSFER_MAX_BYTES = 10 * 1024 * 1024;
export const TRANSFER_MAX_HABITS = 5000;
export const TRANSFER_MAX_CHECKS = 100000;

export interface TransferCheck {
	date: string;
	habitId: string;
	checked: boolean;
}

export interface HabitExport {
	format: 'habitude-obsidian-export';
	version: 1;
	pluginVersion: string;
	exportedAt: string;
	habits: Habit[];
	checks: TransferCheck[];
}

export type TransferErrorCode = 'folder' | 'registry' | 'date' | 'duplicate' | 'unknownHabit' | 'limit' | 'changed';

export class TransferError extends Error {
	constructor(public readonly code: TransferErrorCode) {
		super(code);
	}
}

/** Preserve calendar dates, without applying the computer's timezone. */
export function isTransferDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
	const date = new Date(`${value}T12:00:00.000Z`);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasControl(value: string): boolean {
	return [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

/** Rebuild every field; arbitrary settings, comments and note text cannot leak. */
export function makeHabitExport(
	habits: readonly Habit[],
	checks: readonly TransferCheck[],
	pluginVersion: string,
	exportedAt = new Date().toISOString(),
): HabitExport {
	if (habits.length > TRANSFER_MAX_HABITS || checks.length > TRANSFER_MAX_CHECKS) throw new TransferError('limit');
	const ids = new Set<string>();
	if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(pluginVersion)) throw new TransferError('registry');
	if (!Number.isFinite(new Date(exportedAt).getTime())) throw new TransferError('date');
	const cleanHabits = habits.map((habit) => {
		if (!habit.id || habit.id.length > 200 || /\s/.test(habit.id) || hasControl(habit.id)
			|| ['__proto__', 'prototype', 'constructor'].includes(habit.id) || !habit.title.trim()
			|| habit.title.length > 2000 || hasControl(habit.title)
			|| habit.schedule !== 'daily' || typeof habit.archived !== 'boolean') {
			throw new TransferError('registry');
		}
		if (!isTransferDate(habit.created)) throw new TransferError('date');
		if (ids.has(habit.id)) throw new TransferError('duplicate');
		ids.add(habit.id);
		return { id: habit.id, title: habit.title, created: habit.created, schedule: 'daily' as const, archived: habit.archived };
	}).sort((a, b) => a.id.localeCompare(b.id));
	const seen = new Set<string>();
	const cleanChecks = checks.map((check) => {
		if (typeof check.checked !== 'boolean') throw new TransferError('registry');
		if (!isTransferDate(check.date)) throw new TransferError('date');
		if (!ids.has(check.habitId)) throw new TransferError('unknownHabit');
		const key = JSON.stringify([check.date, check.habitId]);
		if (seen.has(key)) throw new TransferError('duplicate');
		seen.add(key);
		return { date: check.date, habitId: check.habitId, checked: check.checked };
	}).sort((a, b) => a.date.localeCompare(b.date) || a.habitId.localeCompare(b.habitId));
	const result: HabitExport = {
		format: 'habitude-obsidian-export', version: 1,
		pluginVersion,
		exportedAt: new Date(exportedAt).toISOString(), habits: cleanHabits, checks: cleanChecks,
	};
	if (new TextEncoder().encode(JSON.stringify(result, null, 2)).length > TRANSFER_MAX_BYTES) throw new TransferError('limit');
	return result;
}
