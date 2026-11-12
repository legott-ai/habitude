// AI Coach chat view — a local model found on this computer (Ollama /
// LM Studio, no key), or BYOK (bring your own key): Gemini, OpenAI, Claude,
// OpenRouter, or any OpenAI-compatible endpoint.
//
// The chat runs entirely between this device and the selected provider. Your
// API key is stored only in this vault's plugin data and is never sent to
// Habitude servers. What makes this different from chatting with a raw model
// is the curation: every message carries your live habit stats (twin-lite)
// plus the Habitude coaching persona.

import { ItemView, MarkdownRenderer, Notice, Platform, requestUrl, WorkspaceLeaf } from 'obsidian';
import { t } from '../i18n';
import type HabitudePlugin from '../main';
import { buildTwinLiteContext } from '../coach/context';
import {
	isValidBaseUrl,
	isValidLlmModel,
	normalizeLlmApiKey,
	normalizeLlmBaseUrl,
	normalizeLlmModel,
	normalizeLlmProvider,
} from '../types';
import {
	chatCompletion,
	coachConfigProblems,
	CoachError,
	getProvider,
	LLM_PROVIDER_IDS,
	type ChatMessage,
	type CoachConfigProblem,
} from '../coach/providers';
import { buildGreeting, buildSystemPrompt } from '../coach/prompt';
import { findLocalModels, type LocalModel } from '../coach/local-models';
import { renderCompanionCard } from './companion-card';

export const COACH_VIEW_TYPE = 'habitude-coach-view';

function translateOrFallback(primaryKey: string, fallbackKey: string): string {
	const resolved = t(primaryKey);
	return resolved === primaryKey ? t(fallbackKey) : resolved;
}

/**
 * GET a local model server's JSON body. A status outside 200–299 is a
 * failure; an unreadable body counts as no answer.
 */
async function fetchLocalJson(url: string): Promise<unknown> {
	const res = await requestUrl({ url, method: 'GET', throw: false });
	if (res.status < 200 || res.status > 299) {
		throw new Error(`HTTP ${res.status}`);
	}
	try {
		return JSON.parse(res.text) as unknown;
	} catch {
		return undefined;
	}
}

export class CoachView extends ItemView {
	private plugin: HabitudePlugin;
	private messages: ChatMessage[] = [];
	private sending = false;
	private greeted = false;
	private greetingPromise: Promise<void> | null = null;
	private renderSeq = 0;
	private chatSessionSeq = 0;
	private pendingUserText: string | null = null;
	private logEl: HTMLElement | null = null;
	private inputEl: HTMLTextAreaElement | null = null;
	private sendBtnEl: HTMLButtonElement | null = null;
	private composerDraft = '';
	private keyDraft = '';
	private baseUrlDraft: string | null = null;
	private modelDraft: string | null = null;
	private lastSeededBaseUrl = '';
	private lastSeededModel = '';
	private companionHost: HTMLElement | null = null;
	private localHost: HTMLElement | null = null;
	/** Models found by the last search; null until the person searches. Never saved. */
	private localModels: LocalModel[] | null = null;
	private findingLocal = false;
	private localSeq = 0;

	constructor(leaf: WorkspaceLeaf, plugin: HabitudePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return COACH_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t('view.coach.title');
	}

	getIcon(): string {
		return 'sparkles';
	}

	async onOpen(): Promise<void> {
		await this.render();
	}

	async onClose(): Promise<void> {
		++this.renderSeq;
		++this.chatSessionSeq;
		this.sending = false;
		this.pendingUserText = null;
		this.greetingPromise = null;
		this.logEl = null;
		this.inputEl = null;
		this.sendBtnEl = null;
		this.companionHost = null;
		this.resetLocalModels();
	}

	private providerLabel(): string {
		return t(`settings.provider.${this.plugin.settings.llmProvider}`);
	}

	private configProblems(): CoachConfigProblem[] {
		return coachConfigProblems(this.plugin.settings);
	}

	private isConfigured(): boolean {
		return this.configProblems().length === 0;
	}

	private captureDrafts(container: HTMLElement): void {
		const prevComposer = container.querySelector<HTMLTextAreaElement>('.habitude-coach-input');
		if (prevComposer) {
			this.composerDraft = prevComposer.value;
		}
		const prevKey = container.querySelector<HTMLInputElement>(
			'.habitude-coach-key[data-coach-field="apiKey"]',
		);
		if (prevKey) {
			this.keyDraft = prevKey.value;
		}
		const prevBase = container.querySelector<HTMLInputElement>(
			'.habitude-coach-key[data-coach-field="baseUrl"]',
		);
		if (prevBase) {
			this.baseUrlDraft =
				prevBase.value !== this.lastSeededBaseUrl ? prevBase.value : null;
		}
		const prevModel = container.querySelector<HTMLInputElement>(
			'.habitude-coach-key[data-coach-field="model"]',
		);
		if (prevModel) {
			this.modelDraft =
				prevModel.value !== this.lastSeededModel ? prevModel.value : null;
		}
	}

	async render(): Promise<void> {
		const seq = ++this.renderSeq;
		const container = this.containerEl.children[1] as HTMLElement;
		this.captureDrafts(container);
		if (!this.isConfigured()) {
			container.empty();
			this.companionHost = null;
			this.logEl = null;
			this.inputEl = null;
			this.sendBtnEl = null;
			this.localHost = null;
			container.addClass('habitude-coach');
			this.renderSetup(container);
			this.companionHost = container.createDiv();
			this.refreshCompanionPrompt();
		} else {
			this.resetLocalModels();
			await this.renderChat(container, seq);
		}
	}

	/** Preference changes must not clear an API-key or message draft. */
	refreshCompanionPrompt(): void {
		this.companionHost?.empty();
		if (!this.companionHost || !this.plugin.settings.showCompanionPrompts) return;
		renderCompanionCard(this.companionHost, {
			entryPoint: 'coach',
			reason: 'coach',
			onExplore: () => this.plugin.openCompanion('coach'),
			onDismiss: () => {
				void this.plugin.hideCompanionPrompts();
			},
		});
	}

	// -- Setup (missing key or unconfigured custom endpoint) -----------------

	private renderSetup(container: HTMLElement): void {
		const def = getProvider(this.plugin.settings.llmProvider);
		const wrap = container.createDiv({ cls: 'habitude-coach-setup' });
		wrap.createEl('h3', { text: t('coach.setupTitle') });
		wrap.createEl('p', { text: t('coach.setupDesc') });

		if (Platform.isDesktopApp) {
			this.localHost = wrap.createDiv({ cls: 'habitude-coach-local' });
			this.renderLocalSection();
			// "Or connect a provider…" only makes sense under the local option.
			wrap.createEl('h4', { cls: 'habitude-coach-byok-title', text: t('coach.byok.title') });
		}

		const problems = this.configProblems();
		if (problems.length > 0) {
			const needs = wrap.createEl('ul', { cls: 'habitude-coach-setup-needs' });
			for (const problem of problems) {
				needs.createEl('li', {
					text:
						problem === 'key'
							? t('coach.pasteKeyFirst')
							: problem === 'baseUrl'
								? translateOrFallback('coach.setupNeedsBaseUrl', 'settings.baseUrl.requiredDesc')
								: translateOrFallback('coach.setupNeedsModel', 'coach.error.modelRequired'),
				});
			}
		}

		wrap.createEl('label', { cls: 'habitude-coach-field', text: t('settings.provider.name') });
		const select = wrap.createEl('select', { cls: 'habitude-coach-provider' });
		for (const id of LLM_PROVIDER_IDS) {
			const opt = select.createEl('option', { text: t(`settings.provider.${id}`), value: id });
			if (id === this.plugin.settings.llmProvider) opt.selected = true;
		}
		select.addEventListener('change', () => {
			this.plugin.settings.llmProvider = normalizeLlmProvider(select.value);
			void this.plugin.saveSettings();
		});

		let keyInput: HTMLInputElement | null = null;
		if (def.needsKey) {
			if (def.keyUrl) {
				const p = wrap.createEl('p');
				const link = p.createEl('a', { text: t('coach.getKeyLink'), href: def.keyUrl });
				link.setAttr('target', '_blank');
			}
			keyInput = wrap.createEl('input', {
				attr: {
					type: 'password',
					placeholder: this.plugin.settings.llmApiKey
						? t('settings.llmKey.savedPlaceholder')
						: t('coach.keyPlaceholder'),
					'data-coach-field': 'apiKey',
				},
				cls: 'habitude-coach-key',
			});
			keyInput.value = this.keyDraft;
		} else {
			wrap.createEl('p', { text: t('coach.noKeyNeeded') });
		}

		wrap.createEl('label', { cls: 'habitude-coach-field', text: t('settings.baseUrl.name') });
		const baseInput = wrap.createEl('input', {
			attr: {
				type: 'text',
				placeholder: def.defaultBaseUrl || 'https://…',
				'data-coach-field': 'baseUrl',
			},
			cls: 'habitude-coach-key',
		});
		this.lastSeededBaseUrl = this.plugin.settings.llmBaseUrl;
		baseInput.value = this.baseUrlDraft ?? this.plugin.settings.llmBaseUrl;

		let modelInput: HTMLInputElement | null = null;
		if (def.id === 'custom') {
			wrap.createEl('label', { cls: 'habitude-coach-field', text: t('settings.llmModel.name') });
			modelInput = wrap.createEl('input', {
				attr: {
					type: 'text',
					placeholder: def.modelPlaceholder,
					'data-coach-field': 'model',
				},
				cls: 'habitude-coach-key',
			});
			this.lastSeededModel = this.plugin.settings.llmModel;
			modelInput.value = this.modelDraft ?? this.plugin.settings.llmModel;
		}

		const row = wrap.createDiv({ cls: 'habitude-coach-row' });
		const save = row.createEl('button', { text: t('coach.saveKey'), cls: 'mod-cta' });
		save.addEventListener('click', () => {
			const key = keyInput ? normalizeLlmApiKey(keyInput.value) : '';
			if (def.needsKey && !key && !this.plugin.settings.llmApiKey) {
				new Notice(t('coach.pasteKeyFirst'));
				return;
			}
			const rawBase = baseInput.value.trim();
			if (def.id === 'custom' && rawBase === '') {
				new Notice(t('coach.error.baseUrlRequired'));
				return;
			}
			if (rawBase !== '' && !isValidBaseUrl(rawBase)) {
				new Notice(translateOrFallback('coach.error.baseUrlInvalid', 'coach.error.baseUrlRequired'));
				return;
			}
			if (modelInput) {
				const rawModel = modelInput.value.trim();
				if (def.id === 'custom' && rawModel === '') {
					new Notice(t('coach.error.modelRequired'));
					return;
				}
				if (!isValidLlmModel(rawModel)) {
					new Notice(translateOrFallback('settings.llmModel.invalid', 'coach.error.modelRequired'));
					return;
				}
			}
			if (def.needsKey && key) {
				this.plugin.settings.llmApiKey = key;
			}
			this.plugin.settings.llmBaseUrl = normalizeLlmBaseUrl(rawBase);
			if (modelInput) {
				this.plugin.settings.llmModel = normalizeLlmModel(modelInput.value);
			}
			this.keyDraft = '';
			this.baseUrlDraft = null;
			this.modelDraft = null;
			void this.plugin.saveSettings();
		});
		const enterSaves = (e: KeyboardEvent) => {
			if (e.key === 'Enter') save.click();
		};
		if (keyInput) keyInput.addEventListener('keydown', enterSaves);
		baseInput.addEventListener('keydown', enterSaves);
		if (modelInput) modelInput.addEventListener('keydown', enterSaves);
	}

	// -- Local models (Ollama / LM Studio on this computer) ------------------

	/** Drop any search result; a search still running is ignored when it ends. */
	private resetLocalModels(): void {
		++this.localSeq;
		this.findingLocal = false;
		this.localModels = null;
		this.localHost = null;
	}

	private renderLocalSection(): void {
		const host = this.localHost;
		if (!host) return;
		host.empty();
		host.createEl('h4', { text: t('coach.local.title') });
		host.createEl('p', { text: t('coach.local.desc') });
		const find = host.createEl('button', {
			text: this.findingLocal ? t('coach.local.finding') : t('coach.local.find'),
		});
		find.disabled = this.findingLocal;
		find.addEventListener('click', () => {
			void this.findLocal();
		});

		const models = this.localModels;
		if (this.findingLocal || models === null) return;
		if (models.length === 0) {
			host.createEl('p', { text: t('coach.local.none') });
			host.createEl('p', { text: t('coach.local.howto') });
			return;
		}
		const list = host.createDiv({ cls: 'habitude-coach-local-list' });
		for (const model of models) {
			const choose = list.createEl('button', {
				cls: 'habitude-coach-local-model',
				attr: { 'aria-label': t('coach.local.useAria', { name: model.name }) },
			});
			choose.createSpan({ cls: 'habitude-coach-local-model-name', text: model.name });
			choose.createSpan({
				cls: 'habitude-coach-local-model-provider',
				text: getProvider(model.provider).label,
			});
			choose.addEventListener('click', () => {
				void this.chooseLocalModel(model);
			});
		}
	}

	/** Asks the local servers only now, on the person's click. */
	private async findLocal(): Promise<void> {
		if (this.findingLocal) return;
		const seq = this.localSeq;
		this.findingLocal = true;
		this.renderLocalSection();
		const models = await findLocalModels(fetchLocalJson);
		if (seq !== this.localSeq) return;
		this.findingLocal = false;
		this.localModels = models;
		this.renderLocalSection();
	}

	/** Saving re-renders the view; with a local provider and model set, the chat opens. */
	private async chooseLocalModel(model: LocalModel): Promise<void> {
		this.resetLocalModels();
		this.plugin.settings.llmProvider = model.provider;
		this.plugin.settings.llmModel = normalizeLlmModel(model.name);
		// Empty means the provider's default local address. The stored API key is left alone.
		this.plugin.settings.llmBaseUrl = '';
		await this.plugin.saveSettings();
	}

	// -- Chat ---------------------------------------------------------------

	private async renderChat(container: HTMLElement, seq: number): Promise<void> {
		if (!this.greeted) {
			// Mark greeted BEFORE awaiting context so concurrent renders never
			// push duplicate greetings; share the in-flight promise so the
			// winning render waits for the greeting to land in `this.messages`.
			this.greeted = true;
			const sessionSeq = this.chatSessionSeq;
			let currentTask: Promise<void> | null = null;
			currentTask = (async () => {
				try {
					const ctx = await this.context();
					if (sessionSeq !== this.chatSessionSeq || !this.greeted) return;
					this.messages.unshift({ role: 'model', text: buildGreeting(ctx) });
				} catch {
					if (sessionSeq !== this.chatSessionSeq || !this.greeted) return;
					this.messages.unshift({ role: 'model', text: t('coach.fallbackGreeting') });
				} finally {
					if (this.greetingPromise === currentTask) {
						this.greetingPromise = null;
					}
				}
			})();
			this.greetingPromise = currentTask;
		}
		if (this.greetingPromise) {
			await this.greetingPromise;
		}
		if (seq !== this.renderSeq) return;

		container.empty();
		this.companionHost = null;
		container.addClass('habitude-coach');

		const header = container.createDiv({ cls: 'habitude-coach-header' });
		header.createEl('strong', { text: t('coach.headerTitle') });
		const newChat = header.createEl('button', { text: t('coach.newChat') });
		newChat.addEventListener('click', () => {
			++this.chatSessionSeq;
			this.sending = false;
			this.pendingUserText = null;
			this.greetingPromise = null;
			this.messages = [];
			this.greeted = false;
			this.composerDraft = '';
			if (this.inputEl) this.inputEl.value = '';
			void this.render();
		});

		const log = container.createDiv({ cls: 'habitude-coach-log' });
		this.logEl = log;
		for (const m of this.messages) {
			this.pushMessage(log, m.role, m.text);
		}
		if (this.sending && this.pendingUserText !== null) {
			this.pushMessage(log, 'user', this.pendingUserText);
			this.appendTypingBubble(log);
		}

		const composer = container.createDiv({ cls: 'habitude-coach-composer' });
		const input = composer.createEl('textarea', {
			attr: { rows: '2', placeholder: t('coach.inputPlaceholder') },
			cls: 'habitude-coach-input',
		});
		input.value = this.composerDraft;
		this.inputEl = input;

		const send = composer.createEl('button', { text: t('coach.send'), cls: 'mod-cta' });
		send.disabled = this.sending;
		this.sendBtnEl = send;

		const doSend = () => void this.send();
		send.addEventListener('click', doSend);
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				doSend();
			}
		});

		const foot = container.createDiv({ cls: 'habitude-coach-foot' });
		foot.createEl('small', {
			text: t('coach.footnote', { provider: this.providerLabel() }),
		});
		const clear = foot.createEl('a', { text: t('coach.removeKey'), href: '#' });
		clear.addEventListener('click', (e) => {
			e.preventDefault();
			++this.chatSessionSeq;
			this.sending = false;
			this.pendingUserText = null;
			this.greetingPromise = null;
			this.plugin.settings.llmApiKey = '';
			this.messages = [];
			this.greeted = false;
			this.composerDraft = '';
			this.keyDraft = '';
			if (this.inputEl) this.inputEl.value = '';
			void this.plugin.saveSettings();
		});
	}

	private async context() {
		return buildTwinLiteContext(this.plugin.getStore(), this.plugin.settings.weekStart);
	}

	private appendTypingBubble(log: HTMLElement): HTMLElement {
		const typing = log.createDiv({ cls: 'habitude-coach-msg habitude-coach-model habitude-coach-typing' });
		typing.setText(t('coach.thinking'));
		log.scrollTop = log.scrollHeight;
		return typing;
	}

	private removeTypingBubbles(): void {
		this.logEl?.querySelectorAll('.habitude-coach-typing').forEach((el) => el.remove());
	}

	private pushMessage(log: HTMLElement, role: 'user' | 'model', text: string): void {
		const bubble = log.createDiv({ cls: `habitude-coach-msg habitude-coach-${role}` });
		void MarkdownRenderer.render(this.app, text, bubble, '', this);
		log.scrollTop = log.scrollHeight;
	}

	private async send(): Promise<void> {
		const input = this.inputEl;
		if (!input || this.sending) return;
		const text = input.value.trim();
		if (!text) return;

		const problems = this.configProblems();
		if (problems.length > 0) {
			const first = problems[0];
			new Notice(
				first === 'key'
					? t('coach.addKeyFirst')
					: first === 'baseUrl'
						? t('coach.error.baseUrlRequired')
						: t('coach.error.modelRequired'),
			);
			return;
		}

		const sessionSeq = this.chatSessionSeq;
		const historySnapshot = [...this.messages];
		this.sending = true;
		this.pendingUserText = text;
		this.composerDraft = '';
		input.value = '';
		if (this.sendBtnEl) this.sendBtnEl.disabled = true;

		if (this.logEl) {
			this.pushMessage(this.logEl, 'user', text);
			this.appendTypingBubble(this.logEl);
		}

		try {
			const ctx = await this.context();
			if (sessionSeq !== this.chatSessionSeq) return;
			const systemPrompt = buildSystemPrompt(ctx, this.plugin.settings.coachLanguage);
			const reply = await chatCompletion({
				provider: this.plugin.settings.llmProvider,
				apiKey: this.plugin.settings.llmApiKey,
				baseUrl: this.plugin.settings.llmBaseUrl,
				model: this.plugin.settings.llmModel,
				systemPrompt,
				history: historySnapshot,
				message: text,
			});
			if (sessionSeq !== this.chatSessionSeq) return;
			this.removeTypingBubbles();
			this.messages.push({ role: 'user', text });
			this.messages.push({ role: 'model', text: reply });
			if (this.logEl) {
				this.pushMessage(this.logEl, 'model', reply);
			}
		} catch (e) {
			if (sessionSeq !== this.chatSessionSeq) return;
			this.removeTypingBubbles();
			const msg = e instanceof CoachError ? e.message : t('coach.genericError');
			if (this.logEl) {
				const err = this.logEl.createDiv({ cls: 'habitude-coach-msg habitude-coach-error' });
				err.setText(msg);
				this.logEl.scrollTop = this.logEl.scrollHeight;
			}
		} finally {
			if (sessionSeq === this.chatSessionSeq) {
				this.sending = false;
				this.pendingUserText = null;
				if (this.sendBtnEl) this.sendBtnEl.disabled = false;
				if (this.inputEl?.isConnected) this.inputEl.focus();
			}
		}
	}
}
