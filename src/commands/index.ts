// Command registration (stable IDs — do not rename after release).

import { Notice, SuggestModal } from 'obsidian';
import { t } from '../i18n';
import type HabitudePlugin from '../main';
import { ReviewModal } from '../ui/review-modal';
import { addDays, startOfWeek, todayKey } from '../utils/dates';

interface HabitChoice {
	id: string;
	title: string;
}

interface StatusBarRefreshable {
	updateStatusBar?: () => Promise<void>;
}

function refreshStatusBar(plugin: HabitudePlugin): void {
	const candidate = plugin as unknown as StatusBarRefreshable;
	if (typeof candidate.updateStatusBar === 'function') {
		void candidate.updateStatusBar();
	}
}

class HabitSuggestModal extends SuggestModal<HabitChoice> {
	constructor(
		app: import('obsidian').App,
		private onChoose: (h: HabitChoice) => void,
		private habits: HabitChoice[],
	) {
		super(app);
		this.setPlaceholder(t('cmd.pickHabitPlaceholder'));
	}

	getSuggestions(query: string): HabitChoice[] {
		const q = query.toLowerCase();
		return this.habits.filter((h) => h.title.toLowerCase().includes(q));
	}

	renderSuggestion(h: HabitChoice, el: HTMLElement): void {
		el.setText(h.title);
	}

	onChooseSuggestion(h: HabitChoice): void {
		this.onChoose(h);
	}
}

export function registerCommands(plugin: HabitudePlugin): void {
	plugin.addCommand({
		id: 'export-habits',
		name: t('transfer.command'),
		callback: () => plugin.openHabitExport(),
	});

	plugin.addCommand({
		id: 'explore-habitude',
		name: t('cmd.exploreHabitude'),
		callback: () => plugin.openCompanion('command'),
	});

	plugin.addCommand({
		id: 'open-checklist',
		name: t('cmd.openChecklist'),
		callback: () => void plugin.activateView(),
	});

	plugin.addCommand({
		id: 'open-coach',
		name: t('cmd.openCoach'),
		callback: () => void plugin.activateCoachView(),
	});

	plugin.addCommand({
		id: 'open-weekly-review',
		name: t('cmd.openWeeklyReview'),
		callback: () => {
			const store = plugin.getStore();
			const weekStartKey = startOfWeek(todayKey(), plugin.settings.weekStart);
			const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(weekStartKey, i));
			new ReviewModal(plugin.app, store, weekKeys, {
				showCompanionPrompts: () => plugin.settings.showCompanionPrompts,
				onExplore: () => plugin.openCompanion('review'),
				onDismiss: () => plugin.hideCompanionPrompts(),
			}).open();
		},
	});

	plugin.addCommand({
		id: 'toggle-today',
		name: t('cmd.toggleToday'),
		callback: () => {
			void (async () => {
				const store = plugin.getStore();
				const habits = await store.loadHabits();
				if (habits.length === 0) {
					new Notice(t('cmd.noHabitsYet'));
					return;
				}
				new HabitSuggestModal(
					plugin.app,
					(h) => {
						void (async () => {
							try {
								const today = todayKey();
								const checks = await store.loadDayChecks(today);
								const checked = checks.has(h.id);
								await store.setCheck(today, h.id, h.title, !checked);
								new Notice(
									checked
										? t('cmd.toggledUnchecked', { title: h.title })
										: t('cmd.toggledChecked', { title: h.title }),
								);
								plugin.refreshViews();
								refreshStatusBar(plugin);
							} catch {
								new Notice(t('checklist.saveCheckFailed'));
							}
						})();
					},
					habits.map((h) => ({ id: h.id, title: h.title })),
				).open();
			})();
		},
	});
}
