import type { App } from 'obsidian';

// Commands and views may own different stores for the same vault. Share the
// queue by vault identity and normalized path so every local writer sees the
// last completed file contents.
const vaultLocks = new WeakMap<App['vault'], Map<string, Promise<void>>>();

export async function withVaultWriteLock<T>(
	vault: App['vault'],
	path: string,
	write: () => Promise<T>,
): Promise<T> {
	let locks = vaultLocks.get(vault);
	if (!locks) {
		locks = new Map();
		vaultLocks.set(vault, locks);
	}
	const previous = locks.get(path) ?? Promise.resolve();
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const tail = previous.then(() => gate);
	locks.set(path, tail);
	await previous;
	try {
		return await write();
	} finally {
		release();
		if (locks.get(path) === tail) locks.delete(path);
	}
}
