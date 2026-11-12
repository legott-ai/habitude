// Tests for finding local chat models (src/coach/local-models.ts).
//
// Build & run: npm run test:local-models

import {
	findLocalModels,
	isLocalChatModel,
	LMSTUDIO_MODELS_URL,
	LOCAL_PROBE_TIMEOUT_MS,
	MAX_LOCAL_MODELS,
	OLLAMA_TAGS_URL,
	parseOllamaTags,
	parseOpenAiModels,
	type LocalModel,
} from '../../src/coach/local-models';

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
	if (cond) {
		console.log(`  PASS ${name}`);
	} else {
		failures++;
		console.log(`  FAIL ${name}${extra}`);
	}
}

const names = (models: LocalModel[]): string => models.map((m) => `${m.provider}:${m.name}`).join(',');

function fakeGetJson(ollama: unknown, lmstudio: unknown): (url: string) => Promise<unknown> {
	return (url: string) => {
		if (url === OLLAMA_TAGS_URL) {
			if (ollama instanceof Error) return Promise.reject(ollama);
			return Promise.resolve(ollama);
		}
		if (url === LMSTUDIO_MODELS_URL) {
			if (lmstudio instanceof Error) return Promise.reject(lmstudio);
			return Promise.resolve(lmstudio);
		}
		return Promise.reject(new Error('unexpected url'));
	};
}

console.log('urls');
{
	check('OLLAMA_TAGS_URL', OLLAMA_TAGS_URL === 'http://localhost:11434/api/tags', ` got ${OLLAMA_TAGS_URL}`);
	check('LMSTUDIO_MODELS_URL', LMSTUDIO_MODELS_URL === 'http://localhost:1234/v1/models', ` got ${LMSTUDIO_MODELS_URL}`);
}

console.log('ollama tags');
{
	const normal = parseOllamaTags({ models: [{ name: 'gemma4:e4b' }, { name: 'llama3.1' }] });
	check('normal body', normal.join(',') === 'gemma4:e4b,llama3.1', ` got [${normal.join(',')}]`);

	const remote = parseOllamaTags({ models: [{ name: 'a' }, { name: 'b', remote_host: 'https://ollama.com:443' }, { name: 'c', remote_model: 'kimi-k2' }] });
	check('remote_host and remote_model entries skipped', remote.join(',') === 'a', ` got [${remote.join(',')}]`);

	const emptyRemote = parseOllamaTags({ models: [{ name: 'a', remote_host: '' }] });
	check('empty remote_host does not skip', emptyRemote.join(',') === 'a', ` got [${emptyRemote.join(',')}]`);

	const junk = parseOllamaTags({ models: [{ name: 42 }, { name: null }, null, 'x', { name: 'ok' }] });
	check('non-string names skipped', junk.join(',') === 'ok', ` got [${junk.join(',')}]`);

	check('null body', parseOllamaTags(null).length === 0);
	check('empty object', parseOllamaTags({}).length === 0);
	check('models not an array', parseOllamaTags({ models: 'x' }).length === 0);
	check('string body', parseOllamaTags('text').length === 0);
	check('number body', parseOllamaTags(7).length === 0);
}

console.log('openai-style models');
{
	const normal = parseOpenAiModels({ data: [{ id: 'qwen3-8b' }, { id: 'gemma-3-4b' }] });
	check('normal body', normal.join(',') === 'qwen3-8b,gemma-3-4b', ` got [${normal.join(',')}]`);

	check('null body', parseOpenAiModels(null).length === 0);
	check('empty object', parseOpenAiModels({}).length === 0);
	check('data not an array', parseOpenAiModels({ data: {} }).length === 0);
	check('junk entries', parseOpenAiModels({ data: [{ id: 5 }, null] }).length === 0);
	check('string body', parseOpenAiModels('text').length === 0);
}

console.log('chat model filter');
{
	check('gemma4:e4b is chat', isLocalChatModel('gemma4:e4b') === true);
	check('qwen3.8:27b-q4_K_M is chat', isLocalChatModel('qwen3.8:27b-q4_K_M') === true);
	check('llama3.1 is chat', isLocalChatModel('llama3.1') === true);

	check('embeddinggemma:latest is not chat', isLocalChatModel('embeddinggemma:latest') === false);
	check('nomic-embed-text is not chat', isLocalChatModel('nomic-embed-text') === false);
	check('bge-m3 is not chat', isLocalChatModel('bge-m3') === false);
	check('kimi:cloud is not chat', isLocalChatModel('kimi:cloud') === false);
	check('gpt-oss-cloud is not chat', isLocalChatModel('gpt-oss-cloud') === false);
	check('text-embedding-nomic-embed-text-v1.5 is not chat', isLocalChatModel('text-embedding-nomic-embed-text-v1.5') === false);
	check('multilingual-e5-large is not chat', isLocalChatModel('multilingual-e5-large') === false);
}

async function main(): Promise<void> {
	console.log('find local models');
	{
		const ollamaBody = { models: [{ name: 'gemma4:e4b' }, { name: 'embeddinggemma:latest' }, { name: 'kimi:cloud' }, { name: 'gemma4:e4b' }] };
		const lmstudioBody = { data: [{ id: 'qwen3-8b' }, { id: 'text-embedding-nomic-embed-text-v1.5' }, { id: 'qwen3-8b' }] };
		const result = await findLocalModels(fakeGetJson(ollamaBody, lmstudioBody));
		check('Ollama first, then LM Studio; embedding, cloud and duplicate entries dropped', names(result) === 'ollama:gemma4:e4b,lmstudio:qwen3-8b', ` got [${names(result)}]`);
	}
	{
		const result = await findLocalModels(fakeGetJson({ models: [{ name: 'shared' }] }, { data: [{ id: 'shared' }] }));
		check('same name kept once per provider', names(result) === 'ollama:shared,lmstudio:shared', ` got [${names(result)}]`);
	}
	{
		const ollamaBody = { models: [{ name: 'm1' }, { name: 'm2' }, { name: 'm3' }, { name: 'm4' }, { name: 'm5' }] };
		const lmstudioBody = { data: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }, { id: 'n4' }] };
		const result = await findLocalModels(fakeGetJson(ollamaBody, lmstudioBody));
		check('result capped at MAX_LOCAL_MODELS', result.length === MAX_LOCAL_MODELS, ` got ${result.length}`);
		check('cap order: ollama first then lmstudio', names(result) === 'ollama:m1,ollama:m2,ollama:m3,ollama:m4,ollama:m5,lmstudio:n1', ` got [${names(result)}]`);
	}
	{
		const result = await findLocalModels(fakeGetJson(new Error('down'), { data: [{ id: 'qwen3-8b' }] }));
		check('ollama down: lmstudio still found', names(result) === 'lmstudio:qwen3-8b', ` got [${names(result)}]`);

		const result2 = await findLocalModels(fakeGetJson({ models: [{ name: 'llama3.1' }] }, new Error('down')));
		check('lmstudio down: ollama still found', names(result2) === 'ollama:llama3.1', ` got [${names(result2)}]`);
	}
	{
		const result = await findLocalModels(fakeGetJson(new Error('down'), new Error('down')));
		check('both rejecting: empty result', result.length === 0, ` got [${names(result)}]`);
	}
	{
		const throwing = (): Promise<unknown> => { throw new Error('boom'); };
		const result = await findLocalModels(throwing);
		check('synchronous throw: empty result, no exception', result.length === 0, ` got [${names(result)}]`);
	}
	{
		const neverResolves = (): Promise<unknown> => new Promise<unknown>(() => {});
		const started = Date.now();
		const result = await findLocalModels(neverResolves);
		const elapsed = Date.now() - started;
		check('a server that never answers counts as nothing after the timeout', result.length === 0 && elapsed < LOCAL_PROBE_TIMEOUT_MS + 1000, ` got [${names(result)}] elapsed=${elapsed}ms`);
		check('the timeout is waited out, not skipped', elapsed >= LOCAL_PROBE_TIMEOUT_MS - 100, ` elapsed=${elapsed}ms`);
	}

	if (failures > 0) {
		console.log(`\n${failures} local model test(s) failed`);
		process.exit(1);
	}
	console.log('\nAll local model tests passed');
}

void main();
