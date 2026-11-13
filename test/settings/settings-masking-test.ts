// Regression test: the AI coach API key must ALWAYS render as a masked
// password input — never clear text.
//
// A single UI path exists and must mask:
//   getSettingDefinitions() — Obsidian 1.13+ (the plugin's minAppVersion).
//   The declarative SettingControl union has NO password/secret variant, so
//   a plain `control: { type: 'text' }` would expose the key in clear text.
//   The key must use the `render` escape hatch instead.
//   (0.4.2) The display() fallback for Obsidian < 1.13 was removed.
//
// Only fake keys are used; nothing here touches the network.
//
// Build & run:
//   esbuild test/settings/settings-masking-test.ts --bundle --platform=node \
//     --alias:obsidian=./test/stress/mock-obsidian.ts \
//     --outfile=test/settings/dist/settings-masking-test.cjs --format=cjs --log-level=warning \
//   && node test/settings/dist/settings-masking-test.cjs

import { HabitudeSettingTab } from '../../src/settings';
import {
	DEFAULT_SETTINGS,
	isValidBaseUrl,
	isValidVaultFolder,
	MAX_LLM_BASE_URL_LENGTH,
	MAX_LLM_MODEL_LENGTH,
	normalizeCoachLanguage,
	normalizeLlmApiKey,
	normalizeLlmBaseUrl,
	normalizeLlmModel,
	normalizeLlmProvider,
	normalizeVaultFolder,
	normalizeWeekStart,
	type PluginSettings,
} from '../../src/types';
import { Setting } from '../stress/mock-obsidian';
import type {
	App,
	Setting as ObsidianSetting,
	SettingDefinition,
	SettingDefinitionControl,
	SettingDefinitionItem,
	SettingDefinitionRender,
} from 'obsidian';
import type HabitudePlugin from '../../src/main';

let failures = 0;

function check(name: string, cond: boolean, extra = ''): void {
	if (cond) {
		console.log(`  PASS ${name}${extra}`);
	} else {
		failures++;
		console.log(`  FAIL ${name}${extra}`);
	}
}

/** Deliberately fake — never a real credential. */
const FAKE_KEY = 'FAKE-KEY-abc123';

interface FakePlugin {
	settings: PluginSettings;
	saves: number;
	saveSettings: () => Promise<void>;
}

function makePlugin(overrides: Partial<PluginSettings> = {}): FakePlugin {
	const holder: FakePlugin = {
		settings: { ...DEFAULT_SETTINGS, ...overrides },
		saves: 0,
		saveSettings: async () => {
			holder.saves++;
		},
	};
	return holder;
}

function makeTab(plugin: FakePlugin): HabitudeSettingTab {
	const app = {} as unknown as App;
	const typedPlugin = plugin as unknown as HabitudePlugin;
	return new HabitudeSettingTab(app, typedPlugin);
}

function findApiKeyDef(defs: SettingDefinitionItem[]): SettingDefinition | undefined {
	return defs.find(
		(d): d is SettingDefinition =>
			'name' in d && typeof d.name === 'string' && /api key/i.test(d.name),
	);
}

function asRenderDef(def: SettingDefinition): SettingDefinitionRender | undefined {
	return 'render' in def && typeof def.render === 'function' ? def : undefined;
}

function asControlDef(def: SettingDefinition): SettingDefinitionControl | undefined {
	return 'control' in def && def.control !== undefined ? def : undefined;
}

async function testDeclarativePath(): Promise<void> {
	console.log('declarative path (Obsidian 1.13+, display() bypassed):');
	Setting.instances.length = 0;
	const plugin = makePlugin();
	const tab = makeTab(plugin);
	const defs = tab.getSettingDefinitions();

	const def = findApiKeyDef(defs);
	check('API-key definition exists', !!def);
	if (!def) return;
	check('definition carries a name (settings-search indexed)', typeof def.name === 'string' && def.name.length > 0);
	check('definition carries a desc', typeof def.desc === 'string' && def.desc.length > 0);

	// The core regression: a plain text control would render the key unmasked.
	const controlDef = asControlDef(def);
	const isPlainTextControl = !!controlDef && controlDef.control.type === 'text';
	check('NOT a plain text control', !isPlainTextControl, isPlainTextControl ? ' (was type=text)' : '');

	const renderDef = asRenderDef(def);
	check('uses the render escape hatch', !!renderDef);
	if (!renderDef) return;

	// Invoke the render callback the way Obsidian 1.13+ would and inspect the
	// produced input element.
	const setting = new Setting({});
	renderDef.render(setting as unknown as ObsidianSetting, {} as never);
	check('render produced exactly one text input', setting.texts.length === 1);
	const input = setting.texts[0];
	if (!input) return;
	check('input type is password (masked)', input.inputEl.type === 'password', ` (was ${input.inputEl.type})`);
	check('saved key is never pre-filled into the DOM', input.setValueCalls.length === 0);
	check(
		'placeholder invites pasting when empty',
		input.placeholder === 'Paste key to enable the AI coach',
		` (was "${input.placeholder}")`,
	);

	// Typing trims and persists. (The fake saveSettings increments synchronously,
	// so no microtask flush is needed.)
	input.__fireChange(`  ${FAKE_KEY}  `);
	check('typed value is trimmed before storing', plugin.settings.llmApiKey === FAKE_KEY);
	check('change persists via saveSettings', plugin.saves === 1);

	// With a key stored, the placeholder shows a mask hint (still no prefill).
	const plugin2 = makePlugin({ llmApiKey: FAKE_KEY });
	const def2 = findApiKeyDef(makeTab(plugin2).getSettingDefinitions());
	const renderDef2 = def2 ? asRenderDef(def2) : undefined;
	const setting2 = new Setting({});
	if (renderDef2) renderDef2.render(setting2 as unknown as ObsidianSetting, {} as never);
	const input2 = setting2.texts[0];
	check('stored key produced a text input', !!input2);
	if (input2) {
		check(
			'stored key shows mask hint, not the key',
			input2.placeholder === '•••••••• (key saved)',
			` (was "${input2.placeholder}")`,
		);
		check('stored key still never pre-filled', input2.setValueCalls.length === 0);
	}
}

async function testSettingsValidatorsAndEnforcement(): Promise<void> {
	console.log('\nsettings validators & normalizers:');
	check('valid vault folder simple', isValidVaultFolder('Habitude'));
	check('valid vault folder nested', isValidVaultFolder('Areas/Personal/Habitude'));
	check('rejects traversal ..', !isValidVaultFolder('../Outside') && !isValidVaultFolder('Habitude/..'));
	check('rejects dot segment', !isValidVaultFolder('./Inside') && !isValidVaultFolder('.hidden/plugins'));
	check('rejects leading/trailing/double slashes', !isValidVaultFolder('/Root') && !isValidVaultFolder('Habitude/') && !isValidVaultFolder('A//B'));
	check('rejects illegal chars', !isValidVaultFolder('A:B') && !isValidVaultFolder('A\\B') && !isValidVaultFolder('A*B'));
	check('normalizeVaultFolder keeps valid nested trimmed', normalizeVaultFolder('  Areas/Habits  ') === 'Areas/Habits');
	check('normalizeVaultFolder rejects traversal -> default', normalizeVaultFolder('../Escape') === DEFAULT_SETTINGS.dataFolder);
	check('normalizeVaultFolder empty -> default', normalizeVaultFolder('   ') === DEFAULT_SETTINGS.dataFolder);

	check('normalizeWeekStart 0/1 kept', normalizeWeekStart(0) === 0 && normalizeWeekStart(1) === 1);
	check('normalizeWeekStart invalid -> 1', normalizeWeekStart(7) === 1 && normalizeWeekStart('0') === 1);

	check('normalizeLlmProvider valid kept', normalizeLlmProvider('ollama') === 'ollama' && normalizeLlmProvider('custom') === 'custom');
	check('normalizeLlmProvider invalid -> gemini', normalizeLlmProvider('bogus') === 'gemini' && normalizeLlmProvider(42) === 'gemini');

	check('normalizeCoachLanguage valid kept', normalizeCoachLanguage('ko') === 'ko' && normalizeCoachLanguage('en') === 'en');
	check('normalizeCoachLanguage invalid -> auto', normalizeCoachLanguage('fr') === 'auto' && normalizeCoachLanguage(null) === 'auto');

	check('normalizeLlmModel valid trimmed', normalizeLlmModel('  gpt-4o-mini  ') === 'gpt-4o-mini');
	check('normalizeLlmModel caps length', normalizeLlmModel('m'.repeat(MAX_LLM_MODEL_LENGTH)).length === MAX_LLM_MODEL_LENGTH);
	check('normalizeLlmModel overlong -> empty', normalizeLlmModel('m'.repeat(MAX_LLM_MODEL_LENGTH + 1)) === '');
	check('normalizeLlmModel control char -> empty', normalizeLlmModel('bad\nmodel') === '');

	check('isValidBaseUrl accepts https and localhost http', isValidBaseUrl('https://api.openai.com/v1') && isValidBaseUrl('http://localhost:11434/v1'));
	check('isValidBaseUrl rejects empty and non-http schemes', !isValidBaseUrl('') && !isValidBaseUrl('ftp://example.com') && !isValidBaseUrl('javascript:alert(1)'));
	const exactMaxUrl = 'https://example.com/' + 'a'.repeat(MAX_LLM_BASE_URL_LENGTH - 'https://example.com/'.length);
	check('isValidBaseUrl accepts exact 500-char URL', exactMaxUrl.length === MAX_LLM_BASE_URL_LENGTH && isValidBaseUrl(exactMaxUrl));
	check('isValidBaseUrl rejects >500-char URL', !isValidBaseUrl(exactMaxUrl + 'x'));
	check('normalizeLlmBaseUrl rejects invalid & overlong', normalizeLlmBaseUrl('htp://bad') === '' && normalizeLlmBaseUrl(exactMaxUrl + 'x') === '');

	const longSecret = 'sk-' + 'x'.repeat(800);
	check('normalizeLlmApiKey trims without capping length', normalizeLlmApiKey(`  ${longSecret}  `) === longSecret);
	check('normalizeLlmApiKey non-string -> empty', normalizeLlmApiKey(12345) === '' && normalizeLlmApiKey('   ') === '');

	console.log('\nsettings tab enforcement:');
	const plugin = makePlugin({ dataFolder: 'Valid/Folder', llmBaseUrl: 'https://proxy.example.com', llmModel: 'my-model' });
	const tab = makeTab(plugin);

	await tab.setControlValue('dataFolder', '../Outside');
	check('invalid dataFolder rejected without saving', plugin.settings.dataFolder === 'Valid/Folder' && plugin.saves === 0);
	await tab.setControlValue('dataFolder', '   ');
	check('blank dataFolder resets to default and saves', plugin.settings.dataFolder === 'Habitude' && plugin.saves === 1);

	await tab.setControlValue('llmBaseUrl', 'not-a-url');
	check('invalid llmBaseUrl rejected without saving', plugin.settings.llmBaseUrl === 'https://proxy.example.com' && plugin.saves === 1);
	await tab.setControlValue('llmBaseUrl', exactMaxUrl + 'x');
	check('overlong llmBaseUrl rejected without saving', plugin.settings.llmBaseUrl === 'https://proxy.example.com' && plugin.saves === 1);
	await tab.setControlValue('llmBaseUrl', '');
	check('blank llmBaseUrl clears override and saves', plugin.settings.llmBaseUrl === '' && plugin.saves === 2);

	await tab.setControlValue('llmModel', 'm'.repeat(MAX_LLM_MODEL_LENGTH + 1));
	check('overlong llmModel rejected without saving', plugin.settings.llmModel === 'my-model' && plugin.saves === 2);
}

async function main(): Promise<void> {
	await testDeclarativePath();
	await testSettingsValidatorsAndEnforcement();
	if (failures > 0) {
		console.log(`\n${failures} check(s) FAILED`);
		process.exit(1);
	}
	console.log('\nAll password-masking and settings validation checks passed.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
