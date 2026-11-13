// Multi-provider BYOK LLM client for the AI coach.
//
// The user brings their own API key (or none, for local providers). The key
// is stored only in this device's plugin data and is sent ONLY to the
// selected provider — never to Habitude servers.
//
// Non-streaming chat completions: simpler and robust inside Obsidian.
// requestUrl is injectable so unit tests never touch the network.

import { requestUrl } from 'obsidian';
import { t } from '../i18n';
import {
	isValidBaseUrl,
	isValidLlmModel,
	LLM_PROVIDER_IDS,
	type LlmProviderId,
} from '../types';

export { isValidBaseUrl, LLM_PROVIDER_IDS, type LlmProviderId };

/** Default Gemini model id; also the fallback when migrating legacy settings. */
export const DEFAULT_COACH_MODEL = 'gemini-2.5-flash';

/** Cap on conversation history sent per request — the view keeps the full local transcript. */
export const MAX_HISTORY_BLOCKS = 20;

export interface ChatMessage {
	role: 'user' | 'model';
	text: string;
}

type RequestFn = typeof requestUrl;

export class CoachError extends Error {
	readonly kind: 'auth' | 'quota' | 'network' | 'api';
	constructor(kind: CoachError['kind'], message: string) {
		super(message);
		this.kind = kind;
	}
}

export interface BuildRequestArgs {
	baseUrl: string;
	apiKey: string;
	model: string;
	systemPrompt: string;
	history: ChatMessage[];
	message: string;
}

export interface BuiltRequest {
	url: string;
	headers: Record<string, string>;
	body: string;
}

export interface ProviderDef {
	id: LlmProviderId;
	/** Short English label, used in error messages. */
	label: string;
	/** Whether the provider requires an API key. */
	needsKey: boolean;
	defaultBaseUrl: string;
	defaultModel: string;
	modelPlaceholder: string;
	/** Key issuance URL; '' for local providers and custom endpoints. */
	keyUrl: string;
	buildRequest: (args: BuildRequestArgs) => BuiltRequest;
	/** Extract the assistant text from a raw response body (JSON text). */
	parseResponse: (raw: string) => string;
}

export type CoachConfigProblem = 'key' | 'baseUrl' | 'model';

export interface CoachConfigInput {
	llmProvider: LlmProviderId;
	llmApiKey: string;
	llmBaseUrl: string;
	llmModel: string;
}

/**
 * Setup pieces still missing or invalid before the coach can send a message.
 * Prevents the custom provider (which has no default base URL or model) from
 * landing in an unconfigured chat screen and failing only at send time.
 */
export function coachConfigProblems(settings: CoachConfigInput): CoachConfigProblem[] {
	const def = getProvider(settings.llmProvider);
	const problems: CoachConfigProblem[] = [];
	if (def.needsKey && !settings.llmApiKey.trim()) {
		problems.push('key');
	}
	const trimmedBase = settings.llmBaseUrl.trim();
	if (def.id === 'custom') {
		if (!isValidBaseUrl(trimmedBase)) {
			problems.push('baseUrl');
		}
		if (!settings.llmModel.trim() || !isValidLlmModel(settings.llmModel)) {
			problems.push('model');
		}
	} else if (trimmedBase !== '' && !isValidBaseUrl(trimmedBase)) {
		problems.push('baseUrl');
	}
	return problems;
}

/**
 * Join a base URL with an API path. Strips trailing slashes and a trailing
 * '/v1' the user may have included, so user overrides never produce '/v1/v1'.
 */
function joinApiPath(base: string, path: string): string {
	const b = (base || '').replace(/\/+$/, '').replace(/\/v1$/, '');
	return `${b}${path}`;
}

type OpenAiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Shared body builder for OpenAI-compatible chat completion endpoints. */
function buildOpenAiStyleRequest(args: BuildRequestArgs, extraHeaders: Record<string, string> = {}): BuiltRequest {
	const messages: OpenAiMessage[] = [
		{ role: 'system', content: args.systemPrompt },
		...args.history.map(
			(m): OpenAiMessage => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text }),
		),
		{ role: 'user', content: args.message },
	];
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...extraHeaders,
	};
	if (args.apiKey) {
		headers['Authorization'] = `Bearer ${args.apiKey}`;
	}
	return {
		url: joinApiPath(args.baseUrl, '/v1/chat/completions'),
		headers,
		body: JSON.stringify({ model: args.model, messages, temperature: 0.7, max_tokens: 1024 }),
	};
}

/** Extract assistant text from an OpenAI-style chat completion body. */
function parseOpenAiStyleResponse(raw: string): string {
	const data = JSON.parse(raw) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	return data.choices?.[0]?.message?.content ?? '';
}

interface GenerateContentResponse {
	candidates?: Array<{
		content?: { parts?: Array<{ text?: string }> };
		finishReason?: string;
	}>;
	error?: { code?: number; message?: string; status?: string };
}

const geminiProvider: ProviderDef = {
	id: 'gemini',
	label: 'Google Gemini',
	needsKey: true,
	defaultBaseUrl: 'https://generativelanguage.googleapis.com',
	defaultModel: 'gemini-2.5-flash',
	modelPlaceholder: 'gemini-2.5-flash',
	keyUrl: 'https://aistudio.google.com/apikey',
	buildRequest: (args) => {
		const host = (args.baseUrl || '').replace(/\/+$/, '');
		const contents = [
			...args.history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
			{ role: 'user', parts: [{ text: args.message }] },
		];
		return {
			url: `${host}/v1beta/models/${encodeURIComponent(args.model)}:generateContent`,
			headers: { 'Content-Type': 'application/json', 'x-goog-api-key': args.apiKey },
			body: JSON.stringify({
				system_instruction: { parts: [{ text: args.systemPrompt }] },
				contents,
				generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
			}),
		};
	},
	parseResponse: (raw) => {
		const data = JSON.parse(raw) as GenerateContentResponse;
		return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
	},
};

const openaiProvider: ProviderDef = {
	id: 'openai',
	label: 'OpenAI',
	needsKey: true,
	defaultBaseUrl: 'https://api.openai.com',
	defaultModel: 'gpt-4o-mini',
	modelPlaceholder: 'gpt-4o-mini',
	keyUrl: 'https://platform.openai.com/api-keys',
	buildRequest: (args) => buildOpenAiStyleRequest(args),
	parseResponse: parseOpenAiStyleResponse,
};

/**
 * Anthropic message rules: roles are user/assistant only, messages must
 * start with a user turn, and consecutive same-role turns are not allowed.
 * Normalize from our user/model history: map model→assistant, merge
 * consecutive same-role turns (joined with a blank line), drop leading
 * assistant turns.
 */
function normalizeAnthropicMessages(
	history: ChatMessage[],
	message: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
	const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = [];
	const mapRole = (m: ChatMessage): { role: 'user' | 'assistant'; content: string } => ({
		role: m.role === 'model' ? 'assistant' : 'user',
		content: m.text,
	});
	const all: Array<{ role: 'user' | 'assistant'; content: string }> = [
		...history.map(mapRole),
		{ role: 'user', content: message },
	];
	for (const m of all) {
		const last = msgs[msgs.length - 1];
		if (last && last.role === m.role) {
			last.content += `\n\n${m.content}`;
		} else {
			msgs.push({ ...m });
		}
	}
	while (msgs.length > 0 && msgs[0]?.role === 'assistant') {
		msgs.shift();
	}
	return msgs;
}

const anthropicProvider: ProviderDef = {
	id: 'anthropic',
	label: 'Anthropic',
	needsKey: true,
	defaultBaseUrl: 'https://api.anthropic.com',
	defaultModel: 'claude-3-5-sonnet-latest',
	modelPlaceholder: 'claude-3-5-sonnet-latest',
	keyUrl: 'https://console.anthropic.com/settings/keys',
	buildRequest: (args) => ({
		url: joinApiPath(args.baseUrl, '/v1/messages'),
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': args.apiKey,
			'anthropic-version': '2023-06-01',
		},
		body: JSON.stringify({
			model: args.model,
			max_tokens: 1024,
			system: args.systemPrompt,
			messages: normalizeAnthropicMessages(args.history, args.message),
		}),
	}),
	parseResponse: (raw) => {
		const data = JSON.parse(raw) as {
			content?: Array<{ type?: string; text?: string }>;
		};
		return (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
	},
};

const openrouterProvider: ProviderDef = {
	id: 'openrouter',
	label: 'OpenRouter',
	needsKey: true,
	defaultBaseUrl: 'https://openrouter.ai/api',
	defaultModel: 'openai/gpt-4o-mini',
	modelPlaceholder: 'openai/gpt-4o-mini',
	keyUrl: 'https://openrouter.ai/keys',
	buildRequest: (args) =>
		buildOpenAiStyleRequest(args, {
			'HTTP-Referer': 'https://habitude.ai',
			'X-Title': 'Habitude Checklist',
		}),
	parseResponse: parseOpenAiStyleResponse,
};

const ollamaProvider: ProviderDef = {
	id: 'ollama',
	label: 'Ollama',
	needsKey: false,
	defaultBaseUrl: 'http://localhost:11434/v1',
	defaultModel: 'llama3.1',
	modelPlaceholder: 'llama3.1',
	keyUrl: '',
	buildRequest: (args) => buildOpenAiStyleRequest(args),
	parseResponse: parseOpenAiStyleResponse,
};

const lmstudioProvider: ProviderDef = {
	id: 'lmstudio',
	label: 'LM Studio',
	needsKey: false,
	defaultBaseUrl: 'http://localhost:1234/v1',
	defaultModel: 'local-model',
	modelPlaceholder: 'local-model',
	keyUrl: '',
	buildRequest: (args) => buildOpenAiStyleRequest(args),
	parseResponse: parseOpenAiStyleResponse,
};

const customProvider: ProviderDef = {
	id: 'custom',
	label: 'Custom',
	needsKey: false,
	defaultBaseUrl: '',
	defaultModel: '',
	modelPlaceholder: 'model-id',
	keyUrl: '',
	buildRequest: (args) => buildOpenAiStyleRequest(args),
	parseResponse: parseOpenAiStyleResponse,
};

const PROVIDERS: Record<LlmProviderId, ProviderDef> = {
	gemini: geminiProvider,
	openai: openaiProvider,
	anthropic: anthropicProvider,
	openrouter: openrouterProvider,
	ollama: ollamaProvider,
	lmstudio: lmstudioProvider,
	custom: customProvider,
};

/** Unknown ids fall back to Gemini (the historical default). */
export function getProvider(id: string): ProviderDef {
	return (PROVIDERS as Record<string, ProviderDef>)[id] ?? PROVIDERS.gemini;
}

const AUTH_MESSAGE_PATTERN =
	/\b(api[-_ ]?key|x-api-key|x-goog-api-key|auth(?:entication|orization)?|unauthenticated|unauthorized|invalid[-_ ]key|bearer)\b/i;

const AUTH_CODE_SET = new Set([
	'authentication_error',
	'invalid_api_key',
	'invalid x-api-key',
	'api_key_invalid',
	'unauthenticated',
	'unauthorized',
]);

interface ExtractedError {
	code: number | null;
	codeStr: string;
	message: string;
}

function extractErrorInfo(data: unknown): ExtractedError | null {
	if (!data || typeof data !== 'object' || !('error' in data)) return null;
	const rawErr = (data as { error?: unknown }).error;
	if (!rawErr) return null;
	if (typeof rawErr === 'string') {
		return { code: null, codeStr: '', message: rawErr };
	}
	if (typeof rawErr !== 'object') return null;
	const err = rawErr as { code?: unknown; message?: unknown; type?: unknown; status?: unknown };
	const code = typeof err.code === 'number' ? err.code : null;
	const message = typeof err.message === 'string' ? err.message : 'Unknown error';
	const tag =
		typeof err.code === 'string'
			? err.code
			: typeof err.type === 'string'
				? err.type
				: typeof err.status === 'string'
					? err.status
					: '';
	return { code, codeStr: tag.toLowerCase(), message };
}

function isAuthErrorPayload(httpStatus: number, info: ExtractedError | null, rawText: string): boolean {
	if (httpStatus === 401 || httpStatus === 403) return true;
	if (info && (info.code === 401 || info.code === 403 || AUTH_CODE_SET.has(info.codeStr))) {
		return true;
	}
	// HTTP 400 (e.g. Gemini's INVALID_ARGUMENT on bad keys) is only classified
	// as auth when the error payload/message explicitly mentions API keys or
	// authentication — never on bad model IDs, malformed prompts, or Ollama 400s.
	if (httpStatus === 400 || info?.code === 400) {
		const candidate = info ? `${info.message} ${info.codeStr} ${rawText}` : rawText;
		return AUTH_MESSAGE_PATTERN.test(candidate);
	}
	return false;
}

function classifyHttpOrBodyError(
	httpStatus: number,
	parsedBody: unknown,
	rawText: string,
	providerLabel: string,
): CoachError {
	const info = extractErrorInfo(parsedBody);
	if (isAuthErrorPayload(httpStatus, info, rawText)) {
		const isInvalidCode = httpStatus === 401 || httpStatus === 403 || info?.code === 401 || info?.code === 403;
		return new CoachError('auth', isInvalidCode ? t('coach.error.authInvalid') : t('coach.error.authRejected'));
	}
	if (
		httpStatus === 429 ||
		info?.code === 429 ||
		info?.codeStr === 'rate_limit_error' ||
		info?.codeStr === 'resource_exhausted'
	) {
		return new CoachError('quota', t('coach.error.rateLimit'));
	}
	if (info) {
		return new CoachError('api', t('coach.error.modelError', { detail: info.message }));
	}
	return new CoachError('api', t('coach.error.httpError', { provider: providerLabel, status: httpStatus }));
}

function parseJsonSafe(raw: string): { ok: true; value: unknown } | { ok: false } {
	try {
		return { ok: true, value: JSON.parse(raw) as unknown };
	} catch {
		return { ok: false };
	}
}

function classifyTransportError(e: unknown, providerLabel: string): CoachError {
	// With `throw: false`, Obsidian's requestUrl resolves on HTTP 4xx/5xx,
	// while custom/mocked transports in tests may still reject with `{ status, json, text }`.
	const errObj = e as { status?: unknown; json?: unknown; text?: unknown; message?: unknown } | null | undefined;
	const status = typeof errObj?.status === 'number' ? errObj.status : 0;
	if (status >= 400) {
		const rawText =
			typeof errObj?.text === 'string'
				? errObj.text
				: typeof errObj?.message === 'string'
					? errObj.message
					: '';
		let parsedBody: unknown = errObj?.json;
		if (parsedBody === undefined && rawText) {
			const parsed = parseJsonSafe(rawText);
			if (parsed.ok) parsedBody = parsed.value;
		}
		return classifyHttpOrBodyError(status, parsedBody, rawText, providerLabel);
	}
	return new CoachError('network', t('coach.error.network', { detail: String(e) }));
}

function translateBaseUrlInvalid(): string {
	const msg = t('coach.error.baseUrlInvalid');
	return msg === 'coach.error.baseUrlInvalid' ? t('coach.error.baseUrlRequired') : msg;
}

export async function chatCompletion(
	args: {
		provider: LlmProviderId;
		apiKey: string;
		baseUrl: string;
		model: string;
		systemPrompt: string;
		history: ChatMessage[];
		message: string;
	},
	requestFn: RequestFn = requestUrl,
): Promise<string> {
	const def = getProvider(args.provider);
	const baseOverride = (args.baseUrl || '').trim();
	if (baseOverride && !isValidBaseUrl(baseOverride)) {
		throw new CoachError('api', translateBaseUrlInvalid());
	}
	const resolvedBase = baseOverride || def.defaultBaseUrl;
	if (!resolvedBase) {
		throw new CoachError('api', t('coach.error.baseUrlRequired'));
	}
	if (!isValidBaseUrl(resolvedBase)) {
		throw new CoachError('api', translateBaseUrlInvalid());
	}
	const model = (args.model || '').trim() || def.defaultModel;
	if (!model) {
		throw new CoachError('api', t('coach.error.modelRequired'));
	}
	// Sliding window: bound the request size on long conversations.
	const recent = args.history.slice(-MAX_HISTORY_BLOCKS);
	const { url, headers, body } = def.buildRequest({
		baseUrl: resolvedBase,
		apiKey: args.apiKey,
		model,
		systemPrompt: args.systemPrompt,
		history: recent,
		message: args.message,
	});

	let status = 200;
	let raw = '';
	let responseJson: unknown;
	try {
		const res = (await requestFn({
			url,
			method: 'POST',
			headers,
			body,
			throw: false,
		})) as { status?: unknown; text?: unknown; json?: unknown };
		if (typeof res.status === 'number') status = res.status;
		if (typeof res.text === 'string') {
			raw = res.text;
		} else if (res.json !== undefined) {
			responseJson = res.json;
			raw = JSON.stringify(res.json);
		}
		if (responseJson === undefined && res.json !== undefined) {
			responseJson = res.json;
		}
	} catch (e) {
		throw classifyTransportError(e, def.label);
	}

	if (status >= 400) {
		let parsedBody = responseJson;
		if (parsedBody === undefined && raw) {
			const parsed = parseJsonSafe(raw);
			if (parsed.ok) parsedBody = parsed.value;
		}
		throw classifyHttpOrBodyError(status, parsedBody, raw, def.label);
	}

	const parsed = parseJsonSafe(raw);
	if (!parsed.ok) {
		throw new CoachError('api', t('coach.error.unreadable'));
	}

	if (extractErrorInfo(parsed.value)) {
		throw classifyHttpOrBodyError(200, parsed.value, raw, def.label);
	}

	const text = def.parseResponse(raw);
	if (!text.trim()) {
		throw new CoachError('api', t('coach.error.emptyReply'));
	}
	return text.trim();
}
