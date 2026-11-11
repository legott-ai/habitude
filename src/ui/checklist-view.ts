// 7-day checklist ItemView: habits × days grid with click-to-toggle cells,
// local progress graphs, and an opt-in share button.

import { ItemView, Menu, Notice, WorkspaceLeaf } from 'obsidian';
import { getUiLocale, t } from '../i18n';
import type { HabitStore } from '../store';
import type { Habit } from '../types';
import { PAUSED_STREAK_MIN_DAYS, recommendCompanion, type CompanionContext, type CompanionEntryPoint, type PausedStreak } from '../companion';
import { renderCompanionCard } from './companion-card';
import { pausedRunFor, recentKeys, streakFor, weekRateFor } from '../stats';
import { STARTER_HABITS, todaySummary, topicParticle } from '../today';
import { historyStripSvg, weeklyBarsSvg, type GraphDay } from '../graphs';
import { shareFromStore } from '../share';
import { ReviewModal } from './review-modal';
import {
	addDays,
	dayLabel,
	dayNumber,
	startOfWeek,
	todayKey,
	weekRangeLabel,
} from '../utils/dates';

export const CHECKLIST_VIEW_TYPE = 'habitude-checklist-view';

interface ViewDeps {
	getStore: () => HabitStore;
	getWeekStart: () => 0 | 1;
	/** '#rrggbb' color for the ✓ check mark glyph */
	getCheckmarkColor: () => string;
	getPluginVersion: () => string;
	getShowCompanionPrompts: () => boolean;
	onExploreCompanion: (entryPoint: CompanionEntryPoint) => void;
	onHideCompanionPrompts: () => Promise<void>;
	onStatusChange?: () => void;
}

export class ChecklistView extends ItemView {
	private weekOffset = 0;
	private deps: ViewDeps;
	/** Incremented on every render; async fills bail out when stale. */
	private renderSeq = 0;
	private companionHost: HTMLElement | null = null;
	private companionContext: CompanionContext | null = null;

	constructor(leaf: WorkspaceLeaf, deps: ViewDeps) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string {
		return CHECKLIST_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t('view.checklist.title');
	}

	getIcon(): string {
		return 'check-square';
	}

	async onOpen(): Promise<void> {
		await this.render();
	}

	async render(): Promise<void> {
		const seq = ++this.renderSeq;
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('habitude-checklist');
		// User-configurable checkmark color; falls back to the CSS default
		// (white) if unset. saveSettings() re-renders views, so a settings
		// change applies to open checklists immediately.
		container.style.setProperty('--habitude-checkmark-color', this.deps.getCheckmarkColor());

		const store = this.deps.getStore();
		const weekStart = this.deps.getWeekStart();
		const weekStartKey = addDays(startOfWeek(todayKey(), weekStart), this.weekOffset * 7);
		const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(weekStartKey, i));

		// Header: week navigation + review button
		const header = container.createDiv({ cls: 'habitude-header' });
		const prev = header.createEl('button', { text: '‹', cls: 'habitude-nav-btn' });
		prev.onclick = () => {
			this.weekOffset--;
			void this.render();
		};
		header.createSpan({ text: weekRangeLabel(weekStartKey), cls: 'habitude-week-label' });
		const next = header.createEl('button', { text: '›', cls: 'habitude-nav-btn' });
		next.onclick = () => {
			this.weekOffset++;
			void this.render();
		};
		if (this.weekOffset !== 0) {
			const back = header.createEl('button', { text: t('checklist.thisWeek'), cls: 'habitude-review-btn' });
			back.onclick = () => {
				this.weekOffset = 0;
				void this.render();
			};
		}
		header.createDiv({ cls: 'habitude-spacer' });
		const reviewBtn = header.createEl('button', { text: t('checklist.weeklyReview'), cls: 'habitude-review-btn' });
		reviewBtn.onclick = () => new ReviewModal(this.app, store, weekKeys, {
			showCompanionPrompts: this.deps.getShowCompanionPrompts,
			onExplore: () => this.deps.onExploreCompanion('review'),
			onDismiss: this.deps.onHideCompanionPrompts,
		}).open();

		// Add-habit row
		const addRow = container.createDiv({ cls: 'habitude-add-row' });
		const input = addRow.createEl('input', {
			cls: 'habitude-add-input',
			attr: { placeholder: t('checklist.newHabitPlaceholder'), type: 'text' },
		});
		const addBtn = addRow.createEl('button', { text: t('checklist.add'), cls: 'habitude-add-btn' });
		const starterBtns: HTMLButtonElement[] = [];
		let addingHabit = false;
		const setAddControlsDisabled = (disabled: boolean) => {
			addingHabit = disabled;
			input.disabled = disabled;
			addBtn.disabled = disabled;
			for (const btn of starterBtns) {
				btn.disabled = disabled;
			}
		};
		const addHabit = async (title: string) => {
			if (addingHabit) return;
			setAddControlsDisabled(true);
			try {
				await store.addHabit(title);
				new Notice(t('checklist.habitAdded', { title }));
				this.deps.onStatusChange?.();
				void this.render();
			} catch {
				setAddControlsDisabled(false);
				new Notice(t('checklist.addHabitFailed'));
			}
		};
		const doAdd = async () => {
			const title = input.value.trim();
			if (!title) return;
			await addHabit(title);
		};
		addBtn.onclick = () => void doAdd();
		input.onkeydown = (e) => {
			if (e.key === 'Enter') void doAdd();
		};

		// Load the visible week first so the grid paints fast; streaks need
		// 60 days of history and fill in asynchronously afterwards.
		const weekSet = new Set(weekKeys);
		const [habits, weekChecks] = await Promise.all([
			store.loadHabits(),
			store.loadChecksRange(weekKeys),
		]);
		if (seq !== this.renderSeq) return; // superseded while loading
		if (habits.length === 0) {
			// First run: one clear next step. An empty grid, graphs and sharing
			// would only show that there is nothing there yet.
			reviewBtn.remove();
			const empty = container.createDiv({ cls: 'habitude-empty' });
			empty.createEl('strong', { text: t('checklist.emptyTitle'), cls: 'habitude-empty-title' });
			empty.createEl('p', { text: t('checklist.emptyHint'), cls: 'habitude-empty-hint' });
			const starters = empty.createDiv({ cls: 'habitude-starters' });
			for (const title of STARTER_HABITS[getUiLocale()]) {
				const chip = starters.createEl('button', {
					text: title,
					cls: 'habitude-starter',
					attr: { type: 'button', 'aria-label': t('checklist.starterAria', { title }) },
				});
				chip.disabled = addingHabit;
				starterBtns.push(chip);
				chip.onclick = () => {
					void addHabit(title);
				};
			}
			this.companionHost = null;
			this.companionContext = null;
			container.createDiv({ cls: 'habitude-footer' }).createEl('p', {
				text: t('checklist.footnote'),
				cls: 'habitude-footnote',
			});
			return;
		}

		// Today first: how far along the day is and the next habit, one tap to
		// check it. Shown for the current week only.
		if (this.weekOffset === 0) {
			const today = todayKey();
			const summary = todaySummary(habits, weekChecks.get(today));
			const card = container.createDiv({ cls: 'habitude-today-card' });
			const head = card.createDiv({ cls: 'habitude-today-head' });
			head.createSpan({
				text: t('checklist.today.count', { done: summary.done, total: summary.total }),
				cls: 'habitude-today-count',
			});
			const bar = card.createDiv({ cls: 'habitude-bar' });
			bar.createDiv({
				cls: 'habitude-bar-fill',
				attr: { style: `width: ${Math.round((summary.done / summary.total) * 100)}%` },
			});
			const row = card.createDiv({ cls: 'habitude-today-row' });
			const next = summary.next;
			if (next) {
				row.createSpan({
					text: t('checklist.today.ask', { title: next.title, particle: topicParticle(next.title) }),
					cls: 'habitude-today-ask',
				});
				const done = row.createEl('button', {
					text: t('checklist.today.done'),
					cls: 'habitude-today-done',
					attr: { type: 'button' },
				});
				done.onclick = () => {
					done.disabled = true;
					void store
						.setCheck(today, next.id, next.title, true)
						.then(() => {
							this.deps.onStatusChange?.();
							return this.render();
						})
						.catch(() => {
							done.disabled = false;
							new Notice(t('checklist.saveCheckFailed'));
						});
				};
			} else {
				row.createSpan({ text: t('checklist.today.allDone'), cls: 'habitude-today-ask' });
			}
		}

		// Grid
		const grid = container.createDiv({ cls: 'habitude-grid-wrap' });
		const table = grid.createEl('table', { cls: 'habitude-grid' });
		const thead = table.createEl('thead');
		const headRow = thead.createEl('tr');
		headRow.createEl('th', { text: '', cls: 'habitude-col-habit' });
		for (const key of weekKeys) {
			const th = headRow.createEl('th', { cls: 'habitude-col-day' + (key === todayKey() ? ' habitude-today' : '') });
			th.createDiv({ text: dayLabel(key), cls: 'habitude-day-name' });
			th.createDiv({ text: dayNumber(key), cls: 'habitude-day-num' });
		}

		const metaEls = new Map<string, HTMLElement>();
		const tbody = table.createEl('tbody');
		for (const habit of habits) {
			const tr = tbody.createEl('tr');
			const nameCell = tr.createEl('td', { cls: 'habitude-habit-cell' });
			const rate = weekRateFor(habit.id, weekKeys, weekChecks);
			const metaEl = nameCell.createDiv({
				text: `··· ${Math.round(rate * 100)}%`,
				cls: 'habitude-habit-meta',
			});
			metaEls.set(habit.id, metaEl);
			const titleRow = nameCell.createDiv({ cls: 'habitude-title-row' });
			titleRow.createDiv({ text: habit.title, cls: 'habitude-habit-title' });
			const menuBtn = titleRow.createEl('button', {
				text: '\u22EF',
				cls: 'habitude-menu-btn',
				attr: { 'aria-label': t('checklist.habitOptions') },
			});
			menuBtn.onclick = (e) => {
				const menu = new Menu();
				menu.addItem((item) =>
					item.setTitle(t('checklist.archiveHabit')).onClick(() => {
						void store
							.archiveHabit(habit.id)
							.then(() => {
								new Notice(t('checklist.habitArchived', { title: habit.title }));
								this.deps.onStatusChange?.();
								void this.render();
							})
							.catch(() => new Notice(t('checklist.archiveHabitFailed')));
					}),
				);
				menu.showAtMouseEvent(e);
			};
			for (const key of weekKeys) {
				const td = tr.createEl('td', {
					cls: 'habitude-cell' + (key === todayKey() ? ' habitude-today' : ''),
				});
				const checked = weekChecks.get(key)?.has(habit.id) ?? false;
				const btn = td.createEl('button', {
					text: checked ? '✓' : '',
					cls: 'habitude-toggle' + (checked ? ' habitude-checked' : ''),
					attr: {
						'aria-label': t('checklist.toggleAria', { title: habit.title, date: key }),
						'aria-pressed': String(checked),
					},
				});
				btn.onclick = () => {
					btn.disabled = true;
					void store
						.setCheck(key, habit.id, habit.title, !checked)
						.then(() => {
							this.deps.onStatusChange?.();
							return this.render();
						})
						.catch(() => {
							btn.disabled = false;
							new Notice(t('checklist.saveCheckFailed'));
						});
				};
			}
		}

		// Graphs section: populated asynchronously once 60 days of checks load.
		// 100% local SVG rendering — no network involved.
		const graphsSection = container.createDiv({ cls: 'habitude-graphs' });
		graphsSection.createEl('h3', { text: t('checklist.progress'), cls: 'habitude-graphs-title' });
		const graphsBody = graphsSection.createDiv({ cls: 'habitude-graphs-body' });

		// Share row: explicit opt-in button. Nothing is sent unless clicked.
		const shareRow = graphsSection.createDiv({ cls: 'habitude-share-row' });
		const shareBtn = shareRow.createEl('button', {
			text: t('checklist.shareProgress'),
			cls: 'habitude-share-btn',
		});
		shareBtn.onclick = () => {
			shareBtn.disabled = true;
			void shareFromStore(
				() => store.loadHabits(),
				(keys) => store.loadChecksRange(keys),
				this.deps.getPluginVersion(),
			).finally(() => {
				shareBtn.disabled = false;
			});
		};
		shareRow.createEl('p', {
			text: t('checklist.shareNote'),
			cls: 'habitude-share-note',
		});

		// Streaks need 60 days of history: fill them in after the grid is on
		// screen. Guarded by the render sequence so a re-render (e.g. from a
		// toggle) never writes into detached DOM.
		void (async () => {
			const recent = await store.loadChecksRange(recentKeys().filter((k) => !weekSet.has(k)));
			if (seq !== this.renderSeq) return;
			for (const [k, v] of recent) weekChecks.set(k, v);
			for (const habit of habits) {
				const el = metaEls.get(habit.id);
				if (el) {
					const streak = streakFor(habit.id, weekChecks);
					const rate = weekRateFor(habit.id, weekKeys, weekChecks);
					el.setText(`🔥 ${streak} · ${Math.round(rate * 100)}%`);
				}
			}
			// Local progress graphs, rendered from the same 60-day check map.
			for (const habit of habits) {
				this.renderHabitGraphs(graphsBody, habit, weekChecks);
			}
			// A run that just stopped is the moment a suggestion is worth showing.
			let paused: PausedStreak | null = null;
			for (const habit of habits) {
				const days = pausedRunFor(habit.id, weekChecks);
				if (days >= PAUSED_STREAK_MIN_DAYS && days > (paused?.days ?? 0)) paused = { title: habit.title, days };
			}
			if (paused && this.companionContext) {
				this.companionContext = { ...this.companionContext, pausedStreak: paused };
				this.refreshCompanionPrompt();
			}
		})();

		// Discovery follows a question the numbers raise; nothing competes with the first habit.
		const footer = container.createDiv({ cls: 'habitude-footer' });
		this.companionHost = footer.createDiv();
		this.companionContext = {
			habitCount: habits.length,
			weekChecks:
				this.weekOffset === 0
					? weekKeys.reduce(
							(total, key) => total + habits.filter((h) => weekChecks.get(key)?.has(h.id)).length,
							0,
						)
					: 0,
		};
		this.refreshCompanionPrompt();
		footer.createEl('p', {
			text: t('checklist.footnote'),
			cls: 'habitude-footnote',
		});
	}

	/** Update discovery alone so preference changes preserve the add-habit draft. */
	refreshCompanionPrompt(): void {
		this.companionHost?.empty();
		if (!this.companionHost || !this.companionContext?.habitCount || !this.deps.getShowCompanionPrompts()) return;
		const reason = recommendCompanion(this.companionContext);
		if (!reason) return;
		const paused = this.companionContext.pausedStreak;
		renderCompanionCard(this.companionHost, {
			entryPoint: 'checklist',
			reason,
			vars: reason === 'restart' && paused ? { title: paused.title, days: paused.days } : undefined,
			onExplore: () => this.deps.onExploreCompanion('checklist'),
			onDismiss: () => { void this.deps.onHideCompanionPrompts(); },
		});
	}

	/** Append one habit's local graphs (30-day strip + 8 weekly bars). */
	private renderHabitGraphs(
		host: HTMLElement,
		habit: Habit,
		checksByDay: Map<string, Set<string>>,
	): void {
		const card = host.createDiv({ cls: 'habitude-graph-card' });
		const head = card.createDiv({ cls: 'habitude-graph-head' });
		head.createSpan({ text: habit.title, cls: 'habitude-graph-name' });
		head.createSpan({
			text: `🔥 ${streakFor(habit.id, checksByDay)}`,
			cls: 'habitude-graph-streak',
		});

		const today = todayKey();
		const stripDays: GraphDay[] = Array.from({ length: 30 }, (_, i) => {
			const key = addDays(today, -(29 - i));
			return { key, checked: checksByDay.get(key)?.has(habit.id) ?? false };
		});
		mountSvg(card, historyStripSvg(stripDays, `${habit.title}: last 30 days`));

		const weekRates: number[] = [];
		for (let w = 7; w >= 0; w--) {
			const wk = Array.from({ length: 7 }, (_, i) => addDays(today, -(w * 7 + (6 - i))));
			weekRates.push(weekRateFor(habit.id, wk, checksByDay));
		}
		mountSvg(card, weeklyBarsSvg(weekRates, `${habit.title}: weekly completion`));
	}

	async onClose(): Promise<void> {
		++this.renderSeq;
		this.companionHost = null;
		this.companionContext = null;
	}
}

/**
 * Mount an SVG markup string into a host element without innerHTML: the
 * string is generated by our own graph builders (user text is XML-escaped
 * there), parsed as SVG, and imported as a DOM node.
 */
function mountSvg(host: HTMLElement, svg: string): void {
	const ownerDoc = host.ownerDocument ?? document;
	const Parser = ownerDoc.defaultView?.DOMParser ?? DOMParser;
	const doc = new Parser().parseFromString(svg, 'image/svg+xml');
	const node = ownerDoc.importNode(doc.documentElement, true);
	host.appendChild(node);
}
