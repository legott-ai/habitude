// Core domain types and settings normalizers for the Habitude Checklist plugin.
// Local-first: habits + daily checks in Markdown. The optional AI coach is
// BYOK — the user's own API key for any of the supported LLM providers,
// stored on-device, calling the provider directly. No Habitude backend, no
// account, no sync.

import type { CoachLanguage } from './coach/prompt';

export type LlmProviderId =
	| 'gemini'
	| 'openai'
	| 'anthropic'
	| 'openrouter'
	| 'ollama'
	| 'lmstudio'
	| 'custom';

export const LLM_PROVIDER_IDS: LlmProviderId[] = [
	'gemini',
	'openai',
	'anthropic',
	'openrouter',
	'ollama',
	'lmstudio',
	'custom',
];

export interface Habit {
	/** URL-safe unique id, also used as the section heading in Habits.md */
	id: string;
	title: string;
	/** YYYY-MM-DD */
	created: string;
	/** 'daily' for now; weekly/custom schedules are a later stage */
	schedule: 'daily';
	archived: boolean;
}

export interface PluginSettings {
	/** vault-relative folder that holds Habits.md and Log/ */
	dataFolder: string;
	/** 0 = Sunday, 1 = Monday */
	weekStart: 0 | 1;
	/** color of the ✓ check mark in the checklist grid ('#rrggbb'); user-configurable */
	checkmarkColor: string;
	/** AI coach provider (gemini, openai, anthropic, openrouter, ollama, lmstudio, custom) */
	llmProvider: LlmProviderId;
	/** BYOK key for the AI coach. Empty = coach disabled (or local provider without a key). Stored on-device only. */
	llmApiKey: string;
	/** model id used for coaching; empty = provider default */
	llmModel: string;
	/** base URL override; empty = provider default */
	llmBaseUrl: string;
	/** reply language for the coach */
	coachLanguage: CoachLanguage;
	/** Show optional app/plan discovery cards inside Habitude views. No tracking. */
	showCompanionPrompts: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	dataFolder: 'Habitude',
	weekStart: 1,
	checkmarkColor: '#ffffff',
	llmProvider: 'gemini',
	llmApiKey: '',
	llmModel: '',
	llmBaseUrl: '',
	coachLanguage: 'auto',
	showCompanionPrompts: true,
};

export const MAX_LLM_MODEL_LENGTH = 200;
export const MAX_LLM_BASE_URL_LENGTH = 500;

function hasControlChar(value: string): boolean {
	for (const ch of value) {
		const cp = ch.codePointAt(0) ?? 32;
		if (cp < 32 || cp === 127) return true;
	}
	return false;
}

/**
 * Normalize a user-supplied checkmark color to a valid '#rrggbb' string.
 * Anything invalid (including values from older data or hand-edited
 * configs) falls back to the white default so the check mark never renders
 * with a broken color.
 */
export function normalizeCheckmarkColor(value: unknown): string {
	const s = typeof value === 'string' ? value.trim() : '';
	return /^#[0-9a-fA-F]{6}$/.test(s) ? s : DEFAULT_SETTINGS.checkmarkColor;
}

/**
 * True when a vault folder path is safe to read/write under. Nested folders
 * ("Area/Habitude") are allowed; dot segments ("..", "."), leading/trailing
 * slashes, hidden segments, illegal filename/note characters, and control
 * characters are rejected because Obsidian's normalizePath does NOT resolve "..".
 */
export function isValidVaultFolder(folder: unknown): folder is string {
	if (typeof folder !== 'string') return false;
	const s = folder.trim();
	if (!s || s.startsWith('/') || s.endsWith('/')) return false;
	for (const segment of s.split('/')) {
		if (!segment) return false;
		if (segment === '.' || segment === '..') return false;
		if (/^[.\s]/.test(segment) || /[.\s]$/.test(segment)) return false;
		if (/[\\:*?"<>|#^[\]]/.test(segment)) return false;
		if (hasControlChar(segment)) return false;
	}
	return true;
}

/**
 * Normalize a vault folder setting. Blank or unsafe values fall back to
 * `fallback` (default "Habitude") so path traversal cannot escape the folder.
 */
export function normalizeVaultFolder(
	value: unknown,
	fallback: string = DEFAULT_SETTINGS.dataFolder,
): string {
	const s = typeof value === 'string' ? value.trim() : '';
	if (s === '') return fallback;
	return isValidVaultFolder(s) ? s : fallback;
}

export function isValidWeekStart(value: unknown): value is 0 | 1 {
	return value === 0 || value === 1;
}

export function normalizeWeekStart(value: unknown): 0 | 1 {
	return isValidWeekStart(value) ? value : DEFAULT_SETTINGS.weekStart;
}

export function isValidLlmProvider(value: unknown): value is LlmProviderId {
	return typeof value === 'string' && (LLM_PROVIDER_IDS as string[]).includes(value);
}

export function normalizeLlmProvider(value: unknown): LlmProviderId {
	return isValidLlmProvider(value) ? value : DEFAULT_SETTINGS.llmProvider;
}

export function isValidCoachLanguage(value: unknown): value is CoachLanguage {
	return value === 'auto' || value === 'en' || value === 'ko';
}

export function normalizeCoachLanguage(value: unknown): CoachLanguage {
	return isValidCoachLanguage(value) ? value : DEFAULT_SETTINGS.coachLanguage;
}

export function isValidLlmModel(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const s = value.trim();
	return s.length <= MAX_LLM_MODEL_LENGTH && !hasControlChar(s);
}

export function normalizeLlmModel(value: unknown): string {
	if (typeof value !== 'string') return '';
	const s = value.trim();
	return s.length <= MAX_LLM_MODEL_LENGTH && !hasControlChar(s) ? s : '';
}

/**
 * True when a non-empty base URL override is a parseable http(s) URL within
 * MAX_LLM_BASE_URL_LENGTH (500 chars). Plain http is allowed for local
 * Ollama / LM Studio servers; empty string is handled by callers as "use default".
 */
export function isValidBaseUrl(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const s = value.trim();
	if (!s || s.length > MAX_LLM_BASE_URL_LENGTH || hasControlChar(s)) return false;
	let parsed: URL;
	try {
		parsed = new URL(s);
	} catch {
		return false;
	}
	return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
}

export function normalizeLlmBaseUrl(value: unknown): string {
	const s = typeof value === 'string' ? value.trim() : '';
	if (s === '') return '';
	return isValidBaseUrl(s) ? s : '';
}

/**
 * Normalize a stored API key: type-guard + trim only (never length-capped,
 * since silently truncating a secret would break authentication opaquely).
 */
export function normalizeLlmApiKey(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}
