import { Modal, Notice, type App } from 'obsidian';
import { t } from '../i18n';
import { readHabitExport, saveHabitExport } from '../transfer/export';
import { TransferError, type HabitExport } from '../transfer/schema';

export class ExportModal extends Modal {
	private sequence = 0;
	private snapshot: HabitExport | null = null;

	constructor(app: App, private readonly folder: string, private readonly pluginVersion: string) { super(app); }

	async onOpen(): Promise<void> {
		const seq = ++this.sequence;
		this.setTitle(t('transfer.title'));
		this.contentEl.createEl('p', { text: t('transfer.loading') });
		try {
			const snapshot = await readHabitExport(this.app, this.folder, this.pluginVersion);
			if (seq !== this.sequence) return;
			this.snapshot = snapshot;
			this.renderPreview(snapshot);
		} catch (error) {
			if (seq !== this.sequence) return;
			this.contentEl.empty();
			this.contentEl.createEl('p', { text: error instanceof TransferError ? t(`transfer.error.${error.code}`) : t('transfer.error.read') });
		}
	}

	private renderPreview(snapshot: HabitExport): void {
		this.contentEl.empty();
		this.contentEl.createEl('p', { text: t('transfer.local') });
		this.contentEl.createEl('p', { text: t('transfer.summary', {
			habits: snapshot.habits.length, archived: snapshot.habits.filter((habit) => habit.archived).length,
			checks: snapshot.checks.length, checked: snapshot.checks.filter((check) => check.checked).length,
		}) });
		if (snapshot.checks.length) this.contentEl.createEl('p', { text: t('transfer.range', {
			start: snapshot.checks[0]?.date ?? '', end: snapshot.checks[snapshot.checks.length - 1]?.date ?? '',
		}) });
		this.contentEl.createEl('p', { text: t('transfer.scope') });
		this.contentEl.createEl('p', { text: t('transfer.importHelp') });
		const row = this.contentEl.createDiv({ cls: 'habitude-companion-actions' });
		const save = row.createEl('button', { text: t('transfer.save'), cls: 'mod-cta' });
		save.disabled = snapshot.habits.length === 0;
		save.onclick = () => { void this.save(save); };
		const cancel = row.createEl('button', { text: t('transfer.cancel') });
		cancel.onclick = () => this.close();
	}

	private async save(button: HTMLButtonElement): Promise<void> {
		if (!this.snapshot) return;
		button.disabled = true;
		try {
			const file = await saveHabitExport(this.app, this.folder, this.snapshot);
			new Notice(t('transfer.saved', { path: file.path }));
			this.close();
		} catch {
			new Notice(t('transfer.error.save'));
			button.disabled = false;
		}
	}

	onClose(): void { ++this.sequence; this.snapshot = null; this.contentEl.empty(); }
}
