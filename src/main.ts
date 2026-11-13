// Plugin entry point: lifecycle only. Feature logic lives in commands/, ui/,
// store.ts, stats.ts and settings.ts.

import { normalizePath, Notice, Plugin } from 'obsidian';
import { t } from './i18n';
import { DEFAULT_SETTINGS, HabitudeSettingTab, type PluginSettings } from './settings';
import {
	normalizeCheckmarkColor,
	normalizeCoachLanguage,
	normalizeLlmApiKey,
	normalizeLlmBaseUrl,
	normalizeLlmModel,
	normalizeLlmProvider,
	normalizeVaultFolder,
	normalizeWeekStart,
} from './types';
import { DEFAULT_COACH_MODEL } from './coach/providers';
import { HabitStore } from './store';
import { CHECKLIST_VIEW_TYPE, ChecklistView } from './ui/checklist-view';
import { COACH_VIEW_TYPE, CoachView } from './ui/coach-view';
import { registerCommands } from './commands';
import { todayKey } from './utils/dates';
import { normalizeCompanionPrompts, type CompanionEntryPoint } from './companion';
import { CompanionModal } from './ui/companion-modal';
import { ExportModal } from './ui/export-modal';

/** Pre-0.4.2 stored keys. Read once for migration, then purged from data.json. */
interface LegacySettings {
	geminiApiKey?: string;
	coachModel?: string;
}

export default class HabitudePlugin extends Plugin {
	settings!: PluginSettings;
	private store: HabitStore | null = null;
	private statusBarEl: HTMLElement | null = null;
	private refreshTimer: ReturnType<typeof setTimeout> | number | undefined;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(CHECKLIST_VIEW_TYPE, (leaf) =>
			new ChecklistView(leaf, {
				getStore: () => this.getStore(),
				getWeekStart: () => this.settings.weekStart,
				getCheckmarkColor: () => this.settings.checkmarkColor,
				getPluginVersion: () => this.manifest.version,
				getShowCompanionPrompts: () => this.settings.showCompanionPrompts,
				onExploreCompanion: (entryPoint) => this.openCompanion(entryPoint),
				onHideCompanionPrompts: () => this.hideCompanionPrompts(),
				onStatusChange: () => {
					void this.updateStatusBar();
				},
			}),
		);

		this.registerView(COACH_VIEW_TYPE, (leaf) => new CoachView(leaf, this));

		this.addRibbonIcon('check-square', t('ribbon.checklist'), () => {
			void this.activateView();
		});

		this.addRibbonIcon('sparkles', t('ribbon.coach'), () => {
			void this.activateCoachView();
		});

		this.statusBarEl = this.addStatusBarItem();
		void this.updateStatusBar();

		registerCommands(this);
		this.addSettingTab(new HabitudeSettingTab(this.app, this));

		// Re-render open views + status bar when markdown data in the configured
		// Habitude folder changes on disk (edits, sync creates/deletes/renames).
		// Unrelated vault notes are ignored; debounced to avoid render storms.
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (this.isHabitVaultPath(file.path)) this.scheduleVaultRefresh();
			}),
		);
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (this.isHabitVaultPath(file.path)) this.scheduleVaultRefresh();
			}),
		);
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (this.isHabitVaultPath(file.path)) this.scheduleVaultRefresh();
			}),
		);
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (this.isHabitVaultPath(file.path) || this.isHabitVaultPath(oldPath)) {
					this.scheduleVaultRefresh();
				}
			}),
		);
	}

	onunload(): void {
		this.clearRefreshTimer();
	}

	private isHabitVaultPath(path: string): boolean {
		const folder = normalizePath(this.settings.dataFolder);
		const normalized = normalizePath(path);
		return normalized === folder || normalized.startsWith(`${folder}/`);
	}

	private clearRefreshTimer(): void {
		if (this.refreshTimer === undefined) return;
		const cancelTimeout =
			typeof window !== 'undefined' ? window.clearTimeout.bind(window) : clearTimeout;
		cancelTimeout(this.refreshTimer as never);
		this.refreshTimer = undefined;
	}

	private scheduleVaultRefresh(): void {
		this.clearRefreshTimer();
		const scheduleTimeout =
			typeof window !== 'undefined' ? window.setTimeout.bind(window) : setTimeout;
		this.refreshTimer = scheduleTimeout(() => {
			this.refreshTimer = undefined;
			this.refreshViews();
			void this.updateStatusBar();
		}, 400);
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(CHECKLIST_VIEW_TYPE)[0];
		if (existing) {
			void workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getRightLeaf(false);
		if (!leaf) {
			new Notice(t('notice.cannotOpenChecklist'));
			return;
		}
		await leaf.setViewState({ type: CHECKLIST_VIEW_TYPE, active: true });
		void workspace.revealLeaf(leaf);
	}

	async activateCoachView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(COACH_VIEW_TYPE)[0];
		if (existing) {
			void workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getRightLeaf(false);
		if (!leaf) {
			new Notice(t('notice.cannotOpenCoach'));
			return;
		}
		await leaf.setViewState({ type: COACH_VIEW_TYPE, active: true });
		void workspace.revealLeaf(leaf);
	}

	/** Opening discovery stays local; only an explicit website link leaves Obsidian. */
	openCompanion(entryPoint: CompanionEntryPoint): void {
		new CompanionModal(this.app, entryPoint, () => this.openHabitExport()).open();
	}

	openHabitExport(): void {
		new ExportModal(this.app, this.settings.dataFolder, this.manifest.version).open();
	}

	async hideCompanionPrompts(): Promise<void> {
		await this.setCompanionPrompts(false);
	}

	async setCompanionPrompts(show: boolean): Promise<void> {
		const previous = this.settings.showCompanionPrompts;
		this.settings.showCompanionPrompts = show;
		try {
			await this.saveData(this.settings);
			// Keep unsaved coach input and active conversations intact.
			for (const type of [CHECKLIST_VIEW_TYPE, COACH_VIEW_TYPE]) {
				for (const leaf of this.app.workspace.getLeavesOfType(type)) {
					if (show && (leaf.view instanceof ChecklistView || leaf.view instanceof CoachView)) {
						leaf.view.refreshCompanionPrompt();
					} else if (!show) {
						leaf.view.containerEl.querySelectorAll('.habitude-companion-card')
							.forEach((card) => card.remove());
					}
				}
			}
		} catch {
			this.settings.showCompanionPrompts = previous;
			new Notice(t('companion.savePreferenceFailed'));
		}
	}

	/** Lazily created store bound to the configured data folder. */
	getStore(): HabitStore {
		if (!this.store) {
			this.store = new HabitStore(this.app, this.settings.dataFolder);
		}
		return this.store;
	}

	/** Re-render every open checklist and coach view (e.g. after a settings change). */
	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(CHECKLIST_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof ChecklistView) {
				void view.render();
			}
		}
		for (const leaf of this.app.workspace.getLeavesOfType(COACH_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof CoachView) {
				void view.render();
			}
		}
	}

	async updateStatusBar(): Promise<void> {
		if (!this.statusBarEl) return;
		try {
			const store = this.getStore();
			const habits = await store.loadHabits();
			if (habits.length === 0) {
				this.statusBarEl.setText('');
				return;
			}
			const checks = await store.loadDayChecks(todayKey());
			const done = habits.filter((h) => checks.has(h.id)).length;
			this.statusBarEl.setText(t('statusbar.today', { done, total: habits.length }));
		} catch {
			this.statusBarEl.setText('');
		}
	}

	async loadSettings(): Promise<void> {
		// Legacy keys (pre-0.4.2) may still sit in stored data; they are read
		// here, migrated once, and purged below. They no longer exist in
		// PluginSettings/DEFAULT_SETTINGS.
		const raw = ((await this.loadData()) ?? {}) as Partial<PluginSettings> & LegacySettings;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
		this.settings.dataFolder = normalizeVaultFolder(this.settings.dataFolder);
		this.settings.weekStart = normalizeWeekStart(this.settings.weekStart);
		// New setting: users without it (pre-checkmark-color versions) inherit
		// the white default via Object.assign; invalid values are normalized
		// so the check mark can never render with a broken color.
		this.settings.checkmarkColor = normalizeCheckmarkColor(this.settings.checkmarkColor);
		this.settings.showCompanionPrompts = normalizeCompanionPrompts(this.settings.showCompanionPrompts);
		this.settings.llmProvider = normalizeLlmProvider(this.settings.llmProvider);
		this.settings.llmApiKey = normalizeLlmApiKey(this.settings.llmApiKey);
		this.settings.llmModel = normalizeLlmModel(this.settings.llmModel);
		this.settings.llmBaseUrl = normalizeLlmBaseUrl(this.settings.llmBaseUrl);
		this.settings.coachLanguage = normalizeCoachLanguage(this.settings.coachLanguage);
		// One-time migration: legacy geminiApiKey/coachModel → provider-neutral
		// llm* settings. Only runs when the new key is empty and a non-empty
		// legacy key exists, so existing users keep their coach working.
		let migrated = false;
		const legacyKey = normalizeLlmApiKey(raw.geminiApiKey);
		if (!this.settings.llmApiKey && legacyKey) {
			this.settings.llmProvider = 'gemini';
			this.settings.llmApiKey = legacyKey;
			this.settings.llmModel = normalizeLlmModel(raw.coachModel) || DEFAULT_COACH_MODEL;
			migrated = true;
		}
		// Purge legacy keys from stored data: this.settings was rebuilt from
		// DEFAULT_SETTINGS (which has no legacy fields), so saving it drops
		// them from data.json permanently.
		delete (this.settings as unknown as Record<string, unknown>).geminiApiKey;
		delete (this.settings as unknown as Record<string, unknown>).coachModel;
		if (migrated || raw.geminiApiKey !== undefined || raw.coachModel !== undefined) {
			await this.saveData(this.settings);
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Data folder may have changed: drop the cached store and refresh.
		this.store = null;
		this.refreshViews();
		void this.updateStatusBar();
	}
}
