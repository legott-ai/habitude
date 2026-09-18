// Settings: interface, defaults, and the settings tab UI.
// Local-first: checklist settings plus an optional BYOK API key for the AI
// coach (any supported LLM provider). The key is stored only in this
// device's plugin data and is sent only to the selected provider — never
// to Habitude servers.

import { App, Notice, PluginSettingTab, TextComponent, type Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import { t } from './i18n';
import type HabitudePlugin from './main';
import { getProvider, LLM_PROVIDER_IDS, type LlmProviderId } from './coach/providers';
import { canEnableCloudSync } from './cloud/entitlement';
import { validateFirebaseWebConfig } from './cloud/config';
import type { CloudCoordinator } from './cloud/coordinator';
import { DEFAULT_SETTINGS, normalizeCheckmarkColor, type PluginSettings } from './types';

export type { PluginSettings };
export { DEFAULT_SETTINGS };

export class HabitudeSettingTab extends PluginSettingTab {
	/** Transient cloud password: entered for sign-in, never persisted. */
	private cloudPassword = '';

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
			// --- Cloud sync (Premium, opt-in) ---
			{
				name: t('settings.cloud.section'),
				desc: t('settings.cloud.sectionDesc'),
			},
			{
				name: t('settings.cloudEnabled.name'),
				desc: t('settings.cloudEnabled.desc'),
				control: {
					type: 'toggle',
					key: 'cloudEnabled',
					defaultValue: DEFAULT_SETTINGS.cloudEnabled,
				},
			},
			{
				name: t('settings.cloudUseMock.name'),
				desc: t('settings.cloudUseMock.desc'),
				visible: () => this.plugin.settings.cloudEnabled,
				control: {
					type: 'toggle',
					key: 'cloudUseMock',
					defaultValue: DEFAULT_SETTINGS.cloudUseMock,
				},
			},
			{
				name: t('settings.cloudStatus.name'),
				desc: this.cloudStatusText(),
			},
			{
				name: t('settings.cloudUpsell.name'),
				desc: t('settings.cloudUpsell.desc'),
				visible: () => this.cloudShowUpsell(),
			},
			{
				name: t('settings.cloudPrivacy.name'),
				desc: t('settings.cloudPrivacy.desc'),
				visible: () => this.plugin.settings.cloudEnabled,
			},
			{
				name: t('settings.cloudApiKey.name'),
				desc: t('settings.cloudApiKey.desc'),
				visible: () => this.plugin.settings.cloudEnabled && !this.plugin.settings.cloudUseMock,
				render: (setting) => {
					setting.addText((text) => this.configureCloudKeyInput(text));
				},
			},
			{
				name: t('settings.cloudAuthDomain.name'),
				desc: t('settings.cloudAuthDomain.desc'),
				visible: () => this.plugin.settings.cloudEnabled && !this.plugin.settings.cloudUseMock,
				control: {
					type: 'text',
					key: 'cloudAuthDomain',
					placeholder: 'my-app.firebaseapp.com',
					defaultValue: DEFAULT_SETTINGS.cloudAuthDomain,
				},
			},
			{
				name: t('settings.cloudProjectId.name'),
				desc: t('settings.cloudProjectId.desc'),
				visible: () => this.plugin.settings.cloudEnabled && !this.plugin.settings.cloudUseMock,
				control: {
					type: 'text',
					key: 'cloudProjectId',
					defaultValue: DEFAULT_SETTINGS.cloudProjectId,
				},
			},
			{
				name: t('settings.cloudAppId.name'),
				desc: t('settings.cloudAppId.desc'),
				visible: () => this.plugin.settings.cloudEnabled && !this.plugin.settings.cloudUseMock,
				control: {
					type: 'text',
					key: 'cloudAppId',
					defaultValue: DEFAULT_SETTINGS.cloudAppId,
				},
			},
			{
				name: t('settings.cloudStorageBucket.name'),
				desc: t('settings.cloudStorageBucket.desc'),
				visible: () => this.plugin.settings.cloudEnabled && !this.plugin.settings.cloudUseMock,
				control: {
					type: 'text',
					key: 'cloudStorageBucket',
					defaultValue: DEFAULT_SETTINGS.cloudStorageBucket,
				},
			},
			{
				name: t('settings.cloudMessagingSenderId.name'),
				desc: t('settings.cloudMessagingSenderId.desc'),
				visible: () => this.plugin.settings.cloudEnabled && !this.plugin.settings.cloudUseMock,
				control: {
					type: 'text',
					key: 'cloudMessagingSenderId',
					defaultValue: DEFAULT_SETTINGS.cloudMessagingSenderId,
				},
			},
			{
				name: t('settings.cloudEmail.name'),
				desc: t('settings.cloudEmail.desc'),
				visible: () => this.plugin.settings.cloudEnabled,
				control: {
					type: 'text',
					key: 'cloudEmail',
					placeholder: t('settings.cloudEmail.placeholder'),
					defaultValue: DEFAULT_SETTINGS.cloudEmail,
				},
			},
			{
				name: t('settings.cloudPassword.name'),
				desc: t('settings.cloudPassword.desc'),
				visible: () => this.plugin.settings.cloudEnabled,
				render: (setting) => {
					setting.addText((text) => {
						text.inputEl.type = 'password';
						text.setPlaceholder(t('settings.cloudPassword.placeholder'));
						text.onChange((value) => {
							// Transient only: the password is never persisted.
							this.cloudPassword = value;
						});
					});
				},
			},
			{
				name: t('settings.cloud.section'),
				visible: () => this.plugin.settings.cloudEnabled,
				render: (setting) => this.renderCloudAuthButtons(setting),
			},
		];
	}

	getControlValue(key: string): unknown {
		const value = this.plugin.settings[key as keyof PluginSettings];
		// The dropdown control works with strings; keep settings typed as 0 | 1.
		return key === 'weekStart' ? String(value) : value;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'weekStart') {
			this.plugin.settings.weekStart = value === '0' ? 0 : 1;
		} else if (key === 'checkmarkColor') {
			this.plugin.settings.checkmarkColor = normalizeCheckmarkColor(value);
		} else if (key === 'dataFolder') {
			const raw = typeof value === 'string' ? value : '';
			this.plugin.settings.dataFolder = raw.trim() || 'Habitude';
		} else if (key === 'llmProvider') {
			const id = typeof value === 'string' ? value : 'gemini';
			this.plugin.settings.llmProvider = (
				LLM_PROVIDER_IDS as string[]
			).includes(id)
				? (id as LlmProviderId)
				: 'gemini';
		} else if (key === 'llmApiKey') {
			this.plugin.settings.llmApiKey = typeof value === 'string' ? value.trim() : '';
		} else if (key === 'llmModel') {
			this.plugin.settings.llmModel = typeof value === 'string' ? value.trim() : '';
		} else if (key === 'llmBaseUrl') {
			this.plugin.settings.llmBaseUrl = typeof value === 'string' ? value.trim() : '';
		} else if (key === 'coachLanguage') {
			this.plugin.settings.coachLanguage = value === 'ko' ? 'ko' : value === 'en' ? 'en' : 'auto';
		} else if (key === 'cloudEnabled') {
			this.plugin.settings.cloudEnabled = value === true;
		} else if (key === 'cloudUseMock') {
			this.plugin.settings.cloudUseMock = value === true;
		} else if (
			key === 'cloudAuthDomain' ||
			key === 'cloudProjectId' ||
			key === 'cloudAppId' ||
			key === 'cloudStorageBucket' ||
			key === 'cloudMessagingSenderId' ||
			key === 'cloudEmail'
		) {
			this.plugin.settings[key] = typeof value === 'string' ? value.trim() : '';
		} else if (key === 'cloudApiKey') {
			this.plugin.settings.cloudApiKey = typeof value === 'string' ? value.trim() : '';
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
				this.plugin.settings.llmApiKey = value.trim();
				await this.plugin.saveSettings();
			});
	}

	// --- Cloud sync (Premium, opt-in) ---

	/**
	 * Masked input for the Firebase API key. The input never pre-fills the
	 * saved key into the DOM: a mask hint shows instead. Used by the
	 * declarative `render` escape hatch.
	 */
	private configureCloudKeyInput(text: TextComponent): TextComponent {
		text.inputEl.type = 'password';
		return text
			.setPlaceholder(
				this.plugin.settings.cloudApiKey
					? t('settings.cloudApiKey.savedPlaceholder')
					: t('settings.cloudApiKey.emptyPlaceholder'),
			)
			.onChange(async (value) => {
				this.plugin.settings.cloudApiKey = value.trim();
				await this.plugin.saveSettings();
			});
	}

	/**
	 * The cloud coordinator, or null when cloud sync is disabled (or the
	 * plugin object does not provide one, e.g. in tests). The settings tab
	 * must never crash on a missing coordinator.
	 */
	private getCloudCoordinator(): CloudCoordinator | null {
		const getCloud = (this.plugin as Partial<Pick<HabitudePlugin, 'getCloud'>>).getCloud;
		return typeof getCloud === 'function' ? getCloud.call(this.plugin) : null;
	}

	/** Best-effort cloud status line (no network; cached state only). */
	private cloudStatusText(): string {
		const cloud = this.getCloudCoordinator();
		if (!cloud) return t('settings.cloudStatus.disabled');
		switch (cloud.getStatus()) {
			case 'disabled':
				return t('settings.cloudStatus.disabled');
			case 'needs-config':
				return t('settings.cloudStatus.needsConfig');
			case 'signed-out':
				return t('settings.cloudStatus.signedOut');
			case 'not-premium':
				return t('settings.cloudStatus.notPremium');
			case 'ready':
				return t('settings.cloudStatus.ready');
			case 'error':
				return t('settings.cloudStatus.error', { detail: cloud.getLastError() ?? '' });
		}
	}

	/** Show the upsell row when sync is enabled but the account is not premium. */
	private cloudShowUpsell(): boolean {
		if (!this.plugin.settings.cloudEnabled) return false;
		return !canEnableCloudSync(this.getCloudCoordinator()?.getEntitlement() ?? null);
	}

	/** Sign in / sign up / sign out / sync-now buttons (both settings paths). */
	private renderCloudAuthButtons(setting: Setting): void {
		const email = this.getCloudCoordinator()?.getCurrentUserEmail();
		if (email) {
			setting.setName(t('settings.cloudSignedInAs', { email }));
			setting.addButton((btn) =>
				btn.setButtonText(t('settings.cloudSyncNow')).onClick(() => {
					void this.doCloudSyncNow();
				}),
			);
			setting.addButton((btn) =>
				btn.setButtonText(t('settings.cloudSignOut')).onClick(() => {
					void this.doCloudSignOut();
				}),
			);
		} else {
			setting.setName(t('settings.cloudNotSignedIn'));
			setting.addButton((btn) =>
				btn.setButtonText(t('settings.cloudSignIn')).onClick(() => {
					void this.doCloudSignIn();
				}),
			);
			setting.addButton((btn) =>
				btn.setButtonText(t('settings.cloudSignUp')).onClick(() => {
					void this.doCloudSignUp();
				}),
			);
			// Honest disabled button: Google sign-in cannot complete a
			// redirect back into Obsidian's Electron shell, so it is not
			// shipped as a working button.
			setting.addButton((btn) => btn.setButtonText(t('settings.cloudGoogleSoon')).setDisabled(true));
		}
	}

	private cloudCredentials(): { email: string; password: string } | null {
		const email = this.plugin.settings.cloudEmail.trim();
		if (!email || !this.cloudPassword) {
			new Notice(t('settings.cloudCredentialsRequired'));
			return null;
		}
		return { email, password: this.cloudPassword };
	}

	private async doCloudSignIn(): Promise<void> {
		const cloud = this.getCloudCoordinator();
		if (!cloud) {
			new Notice(t('cmd.syncNowDisabled'));
			return;
		}
		const missing = validateFirebaseWebConfig(this.plugin.settings);
		if (missing.length > 0) {
			new Notice(t('settings.cloudConfigIncomplete', { fields: missing.join(', ') }));
			return;
		}
		const creds = this.cloudCredentials();
		if (!creds) return;
		try {
			await cloud.signIn(creds.email, creds.password);
			this.cloudPassword = '';
			new Notice(t('settings.cloudSignedInAs', { email: creds.email }));
		} catch (e) {
			new Notice(e instanceof Error ? e.message : String(e));
		}
	}

	private async doCloudSignUp(): Promise<void> {
		const cloud = this.getCloudCoordinator();
		if (!cloud) {
			new Notice(t('cmd.syncNowDisabled'));
			return;
		}
		const missing = validateFirebaseWebConfig(this.plugin.settings);
		if (missing.length > 0) {
			new Notice(t('settings.cloudConfigIncomplete', { fields: missing.join(', ') }));
			return;
		}
		const creds = this.cloudCredentials();
		if (!creds) return;
		try {
			await cloud.signUp(creds.email, creds.password);
			this.cloudPassword = '';
			new Notice(t('settings.cloudSignedInAs', { email: creds.email }));
		} catch (e) {
			new Notice(e instanceof Error ? e.message : String(e));
		}
	}

	private async doCloudSignOut(): Promise<void> {
		const cloud = this.getCloudCoordinator();
		if (!cloud) return;
		await cloud.signOut();
		new Notice(t('settings.cloudNotSignedIn'));
	}

	private async doCloudSyncNow(): Promise<void> {
		const cloud = this.getCloudCoordinator();
		if (!cloud) {
			new Notice(t('cmd.syncNowDisabled'));
			return;
		}
		try {
			const r = await cloud.syncNow();
			new Notice(t('cmd.syncDone', { pushed: r.pushed, pulled: r.pulled }));
		} catch (e) {
			new Notice(t('cmd.syncFailed', { detail: e instanceof Error ? e.message : String(e) }));
		}
	}
}

