// Settings: interface, defaults, and the settings tab UI.
// Local-first: checklist settings plus an optional BYOK API key for the AI
// coach (any supported LLM provider). The key is stored only in this
// device's plugin data and is sent only to the selected provider — never
// to Habitude servers.

import { App, Notice, PluginSettingTab, TextComponent } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import { t } from './i18n';
import type HabitudePlugin from './main';
import { getProvider, LLM_PROVIDER_IDS } from './coach/providers';
import {
	DEFAULT_SETTINGS,
	isValidBaseUrl,
	isValidLlmModel,
	isValidVaultFolder,
	normalizeCheckmarkColor,
	normalizeCoachLanguage,
	normalizeLlmApiKey,
	normalizeLlmBaseUrl,
	normalizeLlmModel,
	normalizeLlmProvider,
	normalizeVaultFolder,
	normalizeWeekStart,
	type PluginSettings,
} from './types';
import { normalizeCompanionPrompts } from './companion';

export type { PluginSettings };
export { DEFAULT_SETTINGS };

function translateOrFallback(primaryKey: string, fallbackKey: string): string {
	const resolved = t(primaryKey);
	return resolved === primaryKey ? t(fallbackKey) : resolved;
}

export class HabitudeSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: HabitudePlugin) {
		super(app, plugin);
	}

	/**
	 * Declarative settings (Obsidian 1.13.0+, the plugin's minAppVersion):
	 * makes the settings appear in the native settings search.
	 *
	 * NOTE: the declarative SettingControl union has NO password/secret
	 * variant, so a plain `control: { type: 'text' }` would render the API key
	 * in clear text. The key therefore uses the `render` escape hatch
	 * (the community-standard pattern) and hand-renders a password input.
	 * The definition still carries name/desc so settings search keeps working.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		const def = getProvider(this.plugin.settings.llmProvider);
		const providerOptions: Record<string, string> = {};
		for (const id of LLM_PROVIDER_IDS) {
			providerOptions[id] = t(`settings.provider.${id}`);
		}
		return [
			{
				name: t('transfer.title'),
				desc: t('transfer.settingsDesc'),
				render: (setting) => {
					setting.addButton((button) => button.setButtonText(t('transfer.preview'))
						.onClick(() => this.plugin.openHabitExport()));
				},
			},
			{
				name: t('settings.companionExplore.name'),
				desc: t('settings.companionExplore.desc'),
				render: (setting) => {
					setting.addButton((button) => button
						.setButtonText(t('settings.companionExplore.button'))
						.onClick(() => this.plugin.openCompanion('settings')));
				},
			},
			{
				name: t('settings.companionPrompts.name'),
				desc: t('settings.companionPrompts.desc'),
				control: {
					type: 'toggle',
					key: 'showCompanionPrompts',
					defaultValue: DEFAULT_SETTINGS.showCompanionPrompts,
				},
			},
			{
				name: t('settings.dataFolder.name'),
				desc: t('settings.dataFolder.desc'),
				control: {
					type: 'text',
					key: 'dataFolder',
					placeholder: t('settings.dataFolder.placeholder'),
					defaultValue: DEFAULT_SETTINGS.dataFolder,
				},
			},
			{
				name: t('settings.weekStart.name'),
				desc: t('settings.weekStart.desc'),
				control: {
					type: 'dropdown',
					key: 'weekStart',
					options: { '1': t('settings.weekStart.monday'), '0': t('settings.weekStart.sunday') },
					defaultValue: String(DEFAULT_SETTINGS.weekStart),
				},
			},
			{
				name: t('settings.checkmarkColor.name'),
				desc: t('settings.checkmarkColor.desc'),
				control: {
					type: 'color',
					key: 'checkmarkColor',
					defaultValue: DEFAULT_SETTINGS.checkmarkColor,
				},
			},
			{
				name: t('settings.provider.name'),
				desc: t('settings.provider.desc'),
				control: {
					type: 'dropdown',
					key: 'llmProvider',
					options: providerOptions,
					defaultValue: DEFAULT_SETTINGS.llmProvider,
				},
			},
			{
				name: t('settings.llmKey.name'),
				desc: def.needsKey ? t('settings.llmKey.desc') : t('settings.llmKey.noKeyDesc'),
				render: (setting) => {
					// Escape hatch: no declarative password control exists, so the
					// key is rendered as a masked input on 1.13+ too.
					setting.addText((text) => this.configureLlmKeyInput(text));
				},
			},
			{
				name: t('settings.llmModel.name'),
				desc: t('settings.llmModel.desc'),
				control: {
					type: 'text',
					key: 'llmModel',
					placeholder: def.modelPlaceholder,
					defaultValue: DEFAULT_SETTINGS.llmModel,
				},
			},
			{
				name: t('settings.baseUrl.name'),
				desc: def.id === 'custom' ? t('settings.baseUrl.requiredDesc') : t('settings.baseUrl.desc'),
				control: {
					type: 'text',
					key: 'llmBaseUrl',
					placeholder: t('settings.baseUrl.placeholder', { url: def.defaultBaseUrl || '—' }),
					defaultValue: DEFAULT_SETTINGS.llmBaseUrl,
				},
			},
			{
				name: t('settings.coachLanguage.name'),
				desc: t('settings.coachLanguage.desc'),
				control: {
					type: 'dropdown',
					key: 'coachLanguage',
					options: {
						auto: t('settings.coachLanguage.auto'),
						en: t('settings.coachLanguage.english'),
						ko: t('settings.coachLanguage.korean'),
					},
					defaultValue: DEFAULT_SETTINGS.coachLanguage,
				},
			},
			{
				// Info-only row (SettingDefinitionEmpty): no control rendered.
				name: t('settings.sharing.name'),
				desc: t('settings.sharing.desc'),
			},
		];
	}

	getControlValue(key: string): unknown {
		const value = this.plugin.settings[key as keyof PluginSettings];
		// The dropdown control works with strings; keep settings typed as 0 | 1.
		return key === 'weekStart' ? String(value) : value;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'showCompanionPrompts') {
			await this.plugin.setCompanionPrompts(normalizeCompanionPrompts(value));
			return;
		}
		if (key === 'weekStart') {
			this.plugin.settings.weekStart = normalizeWeekStart(
				value === '0' ? 0 : value === '1' ? 1 : value,
			);
		} else if (key === 'checkmarkColor') {
			this.plugin.settings.checkmarkColor = normalizeCheckmarkColor(value);
		} else if (key === 'dataFolder') {
			const raw = typeof value === 'string' ? value.trim() : '';
			if (raw === '') {
				this.plugin.settings.dataFolder = DEFAULT_SETTINGS.dataFolder;
			} else if (!isValidVaultFolder(raw)) {
				new Notice(translateOrFallback('settings.dataFolder.invalid', 'transfer.error.folder'));
				return;
			} else {
				this.plugin.settings.dataFolder = normalizeVaultFolder(raw);
			}
		} else if (key === 'llmProvider') {
			this.plugin.settings.llmProvider = normalizeLlmProvider(value);
		} else if (key === 'llmApiKey') {
			this.plugin.settings.llmApiKey = normalizeLlmApiKey(value);
		} else if (key === 'llmModel') {
			if (typeof value === 'string' && value.trim() !== '' && !isValidLlmModel(value)) {
				new Notice(translateOrFallback('settings.llmModel.invalid', 'coach.error.modelRequired'));
				return;
			}
			this.plugin.settings.llmModel = normalizeLlmModel(value);
		} else if (key === 'llmBaseUrl') {
			const raw = typeof value === 'string' ? value.trim() : '';
			if (raw !== '' && !isValidBaseUrl(raw)) {
				new Notice(translateOrFallback('coach.error.baseUrlInvalid', 'coach.error.baseUrlRequired'));
				return;
			}
			this.plugin.settings.llmBaseUrl = normalizeLlmBaseUrl(value);
		} else if (key === 'coachLanguage') {
			this.plugin.settings.coachLanguage = normalizeCoachLanguage(value);
		}
		await this.plugin.saveSettings();
	}

	/**
	 * Shared wiring for the LLM API-key input, used by the declarative
	 * `render` escape hatch: the key is always a masked password input.
	 *
	 * The input never pre-fills the saved key into the DOM: when a key is
	 * stored the placeholder shows a mask hint instead.
	 */
	private configureLlmKeyInput(text: TextComponent): TextComponent {
		text.inputEl.type = 'password';
		return text
			.setPlaceholder(
				this.plugin.settings.llmApiKey
					? t('settings.llmKey.savedPlaceholder')
					: t('settings.llmKey.emptyPlaceholder'),
			)
			.onChange(async (value) => {
				this.plugin.settings.llmApiKey = normalizeLlmApiKey(value);
				await this.plugin.saveSettings();
			});
	}
}
