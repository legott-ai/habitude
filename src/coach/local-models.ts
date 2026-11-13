// Finds chat models served by Ollama or LM Studio on this computer, so the
// coach can start with a local model and no API key.
//
// The servers are asked only when the person clicks *Find local models* on
// the coach setup screen. Nothing here throws: a server that is down, slow
// or returns an unexpected body simply contributes no models.
//
// The HTTP transport is injected as a parameter so unit tests never touch
// the network.

import { getProvider } from './providers';
import { isValidLlmModel } from '../types';

/** A single local chat model discovered on this machine. */
export interface LocalModel {
	provider: 'ollama' | 'lmstudio';
	name: string;
}

/** Maximum number of models returned by {@link findLocalModels}. */
export const MAX_LOCAL_MODELS = 6;

/** Per-probe timeout in milliseconds. */
export const LOCAL_PROBE_TIMEOUT_MS = 2500;

/** Extract the origin (scheme + host + port) from a base URL. */
function originOf(baseUrl: string): string {
	return new URL(baseUrl).origin;
}

/** URL to fetch Ollama's local model tags. */
export const OLLAMA_TAGS_URL = `${originOf(getProvider('ollama').defaultBaseUrl)}/api/tags`;

/** URL to fetch LM Studio's model list (OpenAI-compatible). */
export const LMSTUDIO_MODELS_URL = `${originOf(getProvider('lmstudio').defaultBaseUrl)}/v1/models`;

/**
 * Parse an Ollama `/api/tags` response body into a list of local model names.
 * Cloud models (those with a non-empty `remote_host` or `remote_model`) are
 * excluded. Never throws.
 */
export function parseOllamaTags(body: unknown): string[] {
	if (body === null || typeof body !== 'object') return [];
	const models = (body as Record<string, unknown>).models;
	if (!Array.isArray(models)) return [];
	const names: string[] = [];
	for (const entry of models) {
		if (entry === null || typeof entry !== 'object') continue;
		const e = entry as Record<string, unknown>;
		if (typeof e.name !== 'string') continue;
		if (typeof e.remote_host === 'string' && e.remote_host.length > 0) continue;
		if (typeof e.remote_model === 'string' && e.remote_model.length > 0) continue;
		const trimmed = e.name.trim();
		if (trimmed.length === 0) continue;
		names.push(trimmed);
	}
	return names;
}

/**
 * Parse an OpenAI-compatible `/v1/models` response body into a list of
 * model ids. Never throws.
 */
export function parseOpenAiModels(body: unknown): string[] {
	if (body === null || typeof body !== 'object') return [];
	const data = (body as Record<string, unknown>).data;
	if (!Array.isArray(data)) return [];
	const names: string[] = [];
	for (const entry of data) {
		if (entry === null || typeof entry !== 'object') continue;
		const e = entry as Record<string, unknown>;
		if (typeof e.id !== 'string') continue;
		const trimmed = e.id.trim();
		if (trimmed.length === 0) continue;
		names.push(trimmed);
	}
	return names;
}

/** Embedding and reranker model families, which cannot hold a chat. */
const NOT_CHAT_PATTERN = /embed|bge-|(^|[/:_-])e5-|nomic|minilm|rerank/i;

/**
 * Heuristic: does the model name look like a local chat model (i.e. not an
 * embedding, reranker, or cloud-hosted variant)?
 */
export function isLocalChatModel(name: string): boolean {
	if (NOT_CHAT_PATTERN.test(name)) return false;
	const lower = name.toLowerCase();
	if (lower.endsWith(':cloud') || lower.endsWith('-cloud')) return false;
	return true;
}

/**
 * Race a promise against a timeout. Resolves to `undefined` if the task
 * does not settle within `ms` milliseconds. Always clears the timer.
 */
async function withTimeout<T>(task: Promise<T>, ms: number): Promise<T | undefined> {
	const scheduleTimeout = typeof window !== 'undefined' ? window.setTimeout.bind(window) : setTimeout;
	const cancelTimeout = typeof window !== 'undefined' ? window.clearTimeout.bind(window) : clearTimeout;
	let timer: ReturnType<typeof setTimeout> | number | undefined;
	try {
		return await Promise.race([
			task,
			new Promise<undefined>((resolve) => {
				timer = scheduleTimeout(() => resolve(undefined), ms);
			}),
		]);
	} finally {
		if (timer !== undefined) cancelTimeout(timer as never);
	}
}

/**
 * Probe a single URL, parse the response, and return model names.
 * Returns an empty array on any failure (timeout, network error, bad body).
 */
async function probe(
	getJson: (url: string) => Promise<unknown>,
	url: string,
	parse: (body: unknown) => string[],
): Promise<string[]> {
	try {
		const body = await withTimeout(getJson(url), LOCAL_PROBE_TIMEOUT_MS);
		return parse(body);
	} catch {
		return [];
	}
}

/**
 * Discover local chat models from Ollama and LM Studio.
 *
 * Probes both providers in parallel, filters out non-chat and cloud models,
 * deduplicates per provider, and caps the result at {@link MAX_LOCAL_MODELS}.
 * Never throws.
 *
 * @param getJson - transport function that performs a GET and returns the parsed JSON body.
 */
export async function findLocalModels(
	getJson: (url: string) => Promise<unknown>,
): Promise<LocalModel[]> {
	try {
		const [ollama, lmstudio] = await Promise.all([
			probe(getJson, OLLAMA_TAGS_URL, parseOllamaTags),
			probe(getJson, LMSTUDIO_MODELS_URL, parseOpenAiModels),
		]);

		const result: LocalModel[] = [];
		const seenOllama = new Set<string>();
		const seenLmstudio = new Set<string>();

		for (const name of ollama) {
			if (result.length >= MAX_LOCAL_MODELS) break;
			if (!isValidLlmModel(name) || !isLocalChatModel(name)) continue;
			if (seenOllama.has(name)) continue;
			seenOllama.add(name);
			result.push({ provider: 'ollama', name });
		}

		for (const name of lmstudio) {
			if (result.length >= MAX_LOCAL_MODELS) break;
			if (!isValidLlmModel(name) || !isLocalChatModel(name)) continue;
			if (seenLmstudio.has(name)) continue;
			seenLmstudio.add(name);
			result.push({ provider: 'lmstudio', name });
		}

		return result;
	} catch {
		return [];
	}
}
