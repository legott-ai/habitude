/**
 * Local-only companion presentation rules. This module never opens a URL,
 * reads vault content, persists state, or contacts an external service.
 */
export type CompanionEntryPoint = 'checklist' | 'coach' | 'review' | 'settings' | 'command';
export type CompanionIntent = 'explore' | 'plans';
export type CompanionReason = 'restart' | 'review' | 'coach';

const COMPANION_ROOT = 'https://habitude.ai/';

function isEntryPoint(value: unknown): value is CompanionEntryPoint {
	return value === 'checklist' || value === 'coach' || value === 'review'
		|| value === 'settings' || value === 'command';
}

/**
 * Build a fixed-destination link with aggregate attribution only. Arbitrary
 * inputs cannot add identifiers, habit data, redirect paths, or query keys.
 * The caller must wait for an explicit user action before opening the URL.
 */
export function buildCompanionUrl(
	entryPoint: CompanionEntryPoint,
	intent: CompanionIntent = 'explore',
): string {
	const url = new URL(COMPANION_ROOT);
	url.searchParams.set('utm_source', 'obsidian');
	url.searchParams.set('utm_medium', 'plugin');
	url.searchParams.set('utm_campaign', 'companion');
	url.searchParams.set('utm_content', isEntryPoint(entryPoint) ? entryPoint : 'command');
	url.searchParams.set('intent', intent === 'plans' ? 'plans' : 'explore');
	return url.toString();
}

export interface CompanionPlan {
	readonly id: 'free' | 'sync' | 'plus';
	readonly name: 'Free' | 'Sync' | 'Plus';
	readonly status: 'available' | 'planned';
	/** Advertised USD price for a single month. */
	readonly monthlyUsd: number;
	/** Advertised USD total billed for an entire year, not a monthly rate. */
	readonly annualUsd: number;
	readonly storageGiB: number;
	readonly sources: number;
	readonly weightedCredits: number;
	/** No checkout or entitlement service is connected to this plugin. */
	readonly canPurchase: false;
}

/** Approved proposal only: paid plans must remain visibly marked planned. */
export const COMPANION_PLANS: readonly CompanionPlan[] = Object.freeze([
	Object.freeze({
		id: 'free', name: 'Free', status: 'available', monthlyUsd: 0, annualUsd: 0,
		storageGiB: 0, sources: 0, weightedCredits: 0, canPurchase: false,
	} satisfies CompanionPlan),
	Object.freeze({
		id: 'sync', name: 'Sync', status: 'planned', monthlyUsd: 2.99, annualUsd: 29.99,
		storageGiB: 10, sources: 2, weightedCredits: 0, canPurchase: false,
	} satisfies CompanionPlan),
	Object.freeze({
		id: 'plus', name: 'Plus', status: 'planned', monthlyUsd: 6.99, annualUsd: 59.99,
		storageGiB: 50, sources: 5, weightedCredits: 200, canPurchase: false,
	} satisfies CompanionPlan),
]);

/** What Habitude does beyond this plugin, each with its real status. Only what is on offer today is 'available'. */
export interface CompanionFeature {
	readonly id: 'web' | 'habi' | 'agent';
	readonly status: 'available' | 'planned';
}
export const COMPANION_FEATURES: readonly CompanionFeature[] = Object.freeze([
	Object.freeze({ id: 'web', status: 'available' } satisfies CompanionFeature),
	Object.freeze({ id: 'habi', status: 'planned' } satisfies CompanionFeature),
	Object.freeze({ id: 'agent', status: 'planned' } satisfies CompanionFeature),
]);

/** A run of checked days that stopped a few days ago. */
export interface PausedStreak {
	readonly title: string;
	readonly days: number;
}

export interface CompanionContext {
	readonly habitCount: number;
	readonly weekChecks: number;
	readonly pausedStreak?: PausedStreak | null;
}

export const PAUSED_STREAK_MIN_DAYS = 3;
export const REVIEW_MIN_CHECKS = 3;

function normalizedCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value)
		? Math.max(0, Math.floor(value))
		: 0;
}

/**
 * The moment worth a suggestion, from existing local context, or none: a
 * suggestion follows a question the numbers raise, never an empty checklist.
 * No impressions, click counters, timers, device identifiers, or
 * recommendation state are recorded.
 */
export function recommendCompanion(context: CompanionContext): 'restart' | 'review' | null {
	if (normalizedCount(context.habitCount) === 0) return null;
	const paused = context.pausedStreak;
	if (paused && typeof paused.title === 'string' && paused.title.trim()
		&& normalizedCount(paused.days) >= PAUSED_STREAK_MIN_DAYS) return 'restart';
	return normalizedCount(context.weekChecks) >= REVIEW_MIN_CHECKS ? 'review' : null;
}

/** Preserve explicit opt-out when loading older or malformed settings. */
export function normalizeCompanionPrompts(value: unknown): boolean {
	return typeof value === 'boolean' ? value : true;
}
