import { TFile, TFolder, normalizePath, type App } from 'obsidian';
import type { Habit } from '../types';
import { isTransferDate, makeHabitExport, TransferError, TRANSFER_MAX_BYTES, type HabitExport, type TransferCheck } from './schema';

/** Export stricter than the display parser: do not invent missing metadata. */
export function parseExportRegistry(markdown: string): Habit[] {
	const sections = markdown.replace(/\r\n/g, '\n').split(/^## /m).slice(1);
	return sections.map((section) => {
		const lines = section.split('\n');
		const id = lines.shift()?.trim() ?? '';
		const fields = new Map<string, string>();
		for (const line of lines) {
			const match = /^- (Title|Created|Schedule|Archived):\s*(.*)$/.exec(line);
			if (!match) continue;
			const key = match[1] ?? '';
			if (fields.has(key)) throw new TransferError('registry');
			fields.set(key, match[2] ?? '');
		}
		if (fields.get('Schedule') !== 'daily' || !['true', 'false'].includes(fields.get('Archived') ?? '')) {
			throw new TransferError('registry');
		}
		return {
			id, title: fields.get('Title') ?? '', created: fields.get('Created') ?? '',
			schedule: 'daily', archived: fields.get('Archived') === 'true',
		};
	});
}

export function parseExportChecks(date: string, markdown: string): TransferCheck[] {
	if (!isTransferDate(date)) throw new TransferError('date');
	const checks: TransferCheck[] = [];
	for (const line of markdown.split('\n')) {
		const match = /^-\s*\[([ xX])\]\s+(\S+)/.exec(line);
		if (match) checks.push({ date, habitId: match[2] ?? '', checked: match[1]?.toLowerCase() === 'x' });
		else if (/^-\s*\[/.test(line)) throw new TransferError('registry');
	}
	return checks;
}

function dataPath(folder: string): string {
	if (!folder.trim() || /[\\:]/.test(folder) || folder.startsWith('/')
		|| folder.split('/').some((part) => part === '..' || part === '.')) throw new TransferError('folder');
	return normalizePath(folder);
}

function logFiles(app: App, folder: string): TFile[] {
	const log = app.vault.getAbstractFileByPath(`${folder}/Log`);
	if (!log) return [];
	if (!(log instanceof TFolder)) throw new TransferError('folder');
	return log.children.filter((file): file is TFile => file instanceof TFile && /^\d{4}-\d{2}-\d{2}\.md$/.test(file.name))
		.sort((a, b) => a.path.localeCompare(b.path));
}

/** Reads only the configured registry and its dated logs; never data.json. */
export async function readHabitExport(app: App, dataFolder: string, pluginVersion: string): Promise<HabitExport> {
	const folder = dataPath(dataFolder);
	const registry = app.vault.getAbstractFileByPath(`${folder}/Habits.md`);
	if (!(registry instanceof TFile)) throw new TransferError('registry');
	const logs = logFiles(app, folder);
	const files = [registry, ...logs];
	const stamps = files.map((file) => ({ path: file.path, mtime: file.stat.mtime, size: file.stat.size }));
	if (stamps.reduce((size, file) => size + file.size, 0) > TRANSFER_MAX_BYTES) throw new TransferError('limit');
	let bytes = 0;
	const read = async (file: TFile): Promise<string> => {
		const content = await app.vault.read(file);
		bytes += new TextEncoder().encode(content).length;
		if (bytes > TRANSFER_MAX_BYTES) throw new TransferError('limit');
		return content;
	};
	const habits = parseExportRegistry(await read(registry));
	const checks: TransferCheck[] = [];
	for (let offset = 0; offset < logs.length; offset += 8) {
		const batch = await Promise.all(logs.slice(offset, offset + 8).map(async (file) =>
			parseExportChecks(file.basename, await read(file))));
		for (const records of batch) checks.push(...records);
	}
	for (const stamp of stamps) {
		const file = app.vault.getAbstractFileByPath(stamp.path);
		if (!(file instanceof TFile) || file.stat.mtime !== stamp.mtime || file.stat.size !== stamp.size) throw new TransferError('changed');
	}
	if (logs.map((file) => file.path).join('\n') !== logFiles(app, folder).map((file) => file.path).join('\n')) throw new TransferError('changed');
	return makeHabitExport(habits, checks, pluginVersion);
}

/** Vault-only JSON copy, deliberately separate from source records. Never overwrite. */
export async function saveHabitExport(app: App, dataFolder: string, snapshot: HabitExport): Promise<TFile> {
	const folder = dataPath(dataFolder);
	const safe = makeHabitExport(snapshot.habits, snapshot.checks, snapshot.pluginVersion, snapshot.exportedAt);
	const exportFolder = `${folder}/Exports`;
	const existing = app.vault.getAbstractFileByPath(exportFolder);
	if (existing && !(existing instanceof TFolder)) throw new TransferError('folder');
	if (!existing) await app.vault.createFolder(exportFolder);
	const stem = `${exportFolder}/habitude-obsidian-${safe.exportedAt.replace(/[:.]/g, '-')}`;
	let path = `${stem}.json`;
	let suffix = 1;
	while (app.vault.getAbstractFileByPath(path)) path = `${stem}-${suffix++}.json`;
	return app.vault.create(path, JSON.stringify(safe, null, 2));
}
