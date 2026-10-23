import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestApp } from '../stress/mock-obsidian';
import { makeHabitExport, isTransferDate, TransferError } from '../../src/transfer/schema';
import { parseExportRegistry, parseExportChecks, readHabitExport, saveHabitExport } from '../../src/transfer/export';

const registry = `# Habits

## read
- Title: Read <10> minutes
- Created: 2024-02-29
- Schedule: daily
- Archived: false

This unrelated PRIVATE_NOTE must stay here.
- ApiKey: FAKE_KEY_MUST_NOT_EXPORT

## 예전-습관
- Title: 예전 습관
- Created: 2020-01-01
- Schedule: daily
- Archived: true
`;

function code(expected: string): (error: unknown) => boolean {
	return (error) => error instanceof TransferError && error.code === expected;
}

async function main(): Promise<void> {
	assert.equal(isTransferDate('2024-02-29'), true);
	assert.equal(isTransferDate('2023-02-29'), false);
	assert.equal(isTransferDate('2026-04-31'), false);
	assert.equal(isTransferDate('2026-1-01'), false);
	assert.equal(isTransferDate('0000-01-01'), false);
	const habits = parseExportRegistry(registry);
	assert.equal(habits.length, 2);
	assert.equal(habits[1]?.archived, true);
	const checks = parseExportChecks('2026-10-23', '- [x] read <!-- Title -->\n- [ ] 예전-습관\nPrivate note not exported');
	const snapshot = makeHabitExport(habits, checks, '0.4.4', '2026-10-23T12:00:00Z');
	assert.equal(snapshot.checks.find((check) => check.habitId === '예전-습관')?.checked, false);
	assert.equal(snapshot.habits.find((habit) => habit.id === '예전-습관')?.created, '2020-01-01');
	const json = JSON.stringify(snapshot);
	assert.equal(json.includes('PRIVATE_NOTE'), false);
	assert.equal(json.includes('FAKE_KEY'), false);
	assert.equal(json.includes('Private note'), false);
	assert.deepEqual(Object.keys(snapshot).sort(), ['checks', 'exportedAt', 'format', 'habits', 'pluginVersion', 'version']);
	assert.throws(() => makeHabitExport([...habits, habits[0]!], checks, '0.4.4'), code('duplicate'));
	assert.throws(() => makeHabitExport(habits, [...checks, checks[0]!], '0.4.4'), code('duplicate'));
	assert.throws(() => makeHabitExport(habits, [{ date: '2026-10-23', habitId: 'orphan', checked: true }], '0.4.4'), code('unknownHabit'));
	assert.throws(() => parseExportRegistry(registry.replace('Schedule: daily', 'Schedule: weekly')), code('registry'));
	assert.throws(() => makeHabitExport(parseExportRegistry(registry.replace('2024-02-29', '2023-02-29')), checks, '0.4.4'), code('date'));
	assert.throws(() => parseExportChecks('2026-10-23', '- [?] read'), code('registry'));

	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'habitude-export-'));
	try {
		fs.mkdirSync(path.join(root, 'Habitude/Log'), { recursive: true });
		const configDirectory = path.join(root, 'private-plugin-config');
		fs.mkdirSync(configDirectory, { recursive: true });
		fs.writeFileSync(path.join(configDirectory, 'data.json'), '{"llmApiKey":"FAKE_KEY_MUST_NOT_EXPORT"}');
		fs.writeFileSync(path.join(root, 'Habitude/Habits.md'), registry);
		fs.writeFileSync(path.join(root, 'Habitude/Log/2026-10-23.md'), '- [x] read\n- [ ] 예전-습관');
		fs.writeFileSync(path.join(root, 'Habitude/Log/README.md'), 'Unrelated note');
		fs.writeFileSync(path.join(root, 'Other-private-note.md'), 'PRIVATE');
		const app = createTestApp(root);
		const paths: string[] = [];
		const read = app.vault.read.bind(app.vault);
		app.vault.read = async (file) => { paths.push(file.path); return read(file); };
		const output = await readHabitExport(app, 'Habitude', '0.4.4');
		assert.deepEqual(paths.sort(), ['Habitude/Habits.md', 'Habitude/Log/2026-10-23.md']);
		assert.equal(output.habits.length, 2);
		assert.equal(output.checks.length, 2);
		const file = await saveHabitExport(app, 'Habitude', output);
		const second = await saveHabitExport(app, 'Habitude', output);
		assert.notEqual(second.path, file.path, 'same-time exports never overwrite the previous copy');
		assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, file.path), 'utf8')), output);
		assert.equal(fs.readFileSync(path.join(root, 'Habitude/Habits.md'), 'utf8'), registry);
		await assert.rejects(() => readHabitExport(app, '../outside', '0.4.4'), code('folder'));
		await assert.rejects(() => readHabitExport(app, '/absolute', '0.4.4'), code('folder'));
		app.vault.read = async (item) => {
			const text = await read(item);
			if (item.path.endsWith('2026-10-23.md')) fs.appendFileSync(path.join(root, 'Habitude/Habits.md'), '\nchanged');
			return text;
		};
		await assert.rejects(() => readHabitExport(app, 'Habitude', '0.4.4'), code('changed'));
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
	console.log('All transfer schema, privacy, archive/false preservation, snapshot and vault export checks passed.');
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
