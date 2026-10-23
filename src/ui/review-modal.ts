// Weekly review modal: this week's completion summary per habit.

import { Modal } from 'obsidian';
import { t } from '../i18n';
import type { Habit } from '../types';
import { recentKeys, streakFor, weekRateFor } from '../stats';
import type { HabitStore } from '../store';
import { renderCompanionCard } from './companion-card';

interface ReviewDiscovery {
	showCompanionPrompts: () => boolean;
	onExplore: () => void;
	onDismiss: () => Promise<void>;
}

export class ReviewModal extends Modal {
	constructor(
		app: import('obsidian').App,
		private store: HabitStore,
		private weekKeys: string[],
		private discovery?: ReviewDiscovery,
	) {
		super(app);
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('habitude-review');
		contentEl.createEl('h2', { text: t('review.title') });

		const habits: Habit[] = await this.store.loadHabits();
		if (habits.length === 0) {
			contentEl.createEl('p', { text: t('review.empty') });
			return;
		}

		const checks = await this.store.loadChecksRange([...this.weekKeys, ...recentKeys()]);
		let totalChecks = 0;

		for (const habit of habits) {
			const rate = weekRateFor(habit.id, this.weekKeys, checks);
			const streak = streakFor(habit.id, checks);
			const checkedDays = this.weekKeys.filter((k) => checks.get(k)?.has(habit.id)).length;
			totalChecks += checkedDays;

			const row = contentEl.createDiv({ cls: 'habitude-review-row' });
			const head = row.createDiv({ cls: 'habitude-review-head' });
			head.createEl('strong', { text: habit.title });
			head.createSpan({
				text: t('review.perHabitMeta', {
					rate: Math.round(rate * 100),
					checked: checkedDays,
					total: this.weekKeys.length,
					streak,
				}),
			});
			const bar = row.createDiv({ cls: 'habitude-bar' });
			bar.createDiv({ cls: 'habitude-bar-fill', attr: { style: `width: ${Math.round(rate * 100)}%` } });
		}

		contentEl.createEl('p', {
			text: t('review.totalChecks', { total: totalChecks }),
			cls: 'habitude-review-total',
		});
		if (totalChecks > 0 && this.discovery?.showCompanionPrompts()) {
			const discovery = this.discovery;
			const host = contentEl.createDiv();
			renderCompanionCard(host, {
				entryPoint: 'review',
				reason: 'review',
				onExplore: discovery.onExplore,
				onDismiss: () => {
					void discovery.onDismiss().then(() => {
						if (!discovery.showCompanionPrompts()) host.empty();
					});
				},
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
