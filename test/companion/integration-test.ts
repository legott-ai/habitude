// Exercise the real settings lifecycle: opting out must survive upgrades,
// preserve credentials and drafts, and leave discovery available on demand.
import assert from 'node:assert/strict';
import type { Command, WorkspaceLeaf } from 'obsidian';
import HabitudePlugin from '../../src/main';
import { HabitudeSettingTab } from '../../src/settings';
import { DEFAULT_SETTINGS } from '../../src/types';
import { registerCommands } from '../../src/commands';

async function load(stored: unknown): Promise<HabitudePlugin> {
	const plugin = Object.create(HabitudePlugin.prototype) as HabitudePlugin;
	plugin.loadData = async () => stored;
	plugin.saveData = async () => {};
	await plugin.loadSettings();
	return plugin;
}

async function main(): Promise<void> {
	const fresh = await load(null);
	assert.equal(fresh.settings.showCompanionPrompts, true);
	const older = await load({ llmApiKey: 'FAKE-EXISTING-KEY', llmProvider: 'openai' });
	assert.equal(older.settings.showCompanionPrompts, true);
	assert.equal(older.settings.llmApiKey, 'FAKE-EXISTING-KEY');
	for (const value of [false, true]) {
		assert.equal((await load({ showCompanionPrompts: value })).settings.showCompanionPrompts, value);
	}
	for (const value of ['false', 0, [], {}]) {
		assert.equal((await load({ showCompanionPrompts: value })).settings.showCompanionPrompts, true);
	}

	let removed = 0;
	let refreshed = false;
	let persisted: unknown;
	const plugin = await load({ showCompanionPrompts: true, llmApiKey: 'FAKE-EXISTING-KEY' });
	const draft = { value: 'unsaved coach input' };
	const leaf = {
		view: {
			containerEl: {
				querySelectorAll: (selector: string) => {
					assert.equal(selector, '.habitude-companion-card');
					return [{ remove: () => { removed++; } }];
				},
			},
		},
	} as unknown as WorkspaceLeaf;
	plugin.app = { workspace: { getLeavesOfType: () => [leaf] } } as unknown as HabitudePlugin['app'];
	plugin.refreshViews = () => { refreshed = true; draft.value = ''; };
	plugin.saveData = async (settings: unknown) => { persisted = structuredClone(settings); };
	await plugin.hideCompanionPrompts();
	assert.equal(plugin.settings.showCompanionPrompts, false);
	assert.equal(removed, 2, 'remove discovery from both checklist and coach');
	assert.equal(refreshed, false, 'do not rebuild forms and discard drafts');
	assert.equal(draft.value, 'unsaved coach input');
	assert.equal(plugin.settings.llmApiKey, 'FAKE-EXISTING-KEY');
	assert.equal((await load(persisted)).settings.showCompanionPrompts, false);

	const failed = await load({ showCompanionPrompts: true });
	failed.saveData = async () => { throw new Error('disk full'); };
	await failed.hideCompanionPrompts();
	assert.equal(failed.settings.showCompanionPrompts, true, 'failed disk write restores preference');

	const tab = new HabitudeSettingTab(plugin.app, plugin);
	const toggle = tab.getSettingDefinitions().find((row) =>
		'control' in row && row.control?.key === 'showCompanionPrompts');
	assert.ok(toggle && 'control' in toggle && toggle.control?.type === 'toggle');
	plugin.saveSettings = async () => {};
	await tab.setControlValue('showCompanionPrompts', true);
	assert.equal(tab.getControlValue('showCompanionPrompts'), true);
	await tab.setControlValue('showCompanionPrompts', false);
	assert.equal(tab.getControlValue('showCompanionPrompts'), false);
	assert.equal(refreshed, false, 'settings toggle also preserves drafts');

	const commands: Command[] = [];
	let entry = '';
	plugin.addCommand = (command) => { commands.push(command); return command; };
	plugin.openCompanion = (entryPoint) => { entry = entryPoint; };
	registerCommands(plugin);
	const explore = commands.find((command) => command.id === 'explore-habitude');
	assert.ok(explore?.callback);
	explore.callback();
	assert.equal(entry, 'command', 'manual discovery still works while prompts are hidden');
	assert.deepEqual(commands.map((c) => c.id).filter((id) => id !== 'explore-habitude'),
		['export-habits', 'open-checklist', 'open-coach', 'open-weekly-review', 'toggle-today']);
	assert.equal(DEFAULT_SETTINGS.llmApiKey, '', 'defaults remain unmodified');
	console.log('All companion settings, dismissal, migration and command checks passed.');
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
