// Test double for 'firebase/app'.
// Records module evaluation on globalThis so tests can assert the SDK is
// loaded lazily (never at plugin load when cloud sync is disabled).
// Only the functions the plugin uses are stubbed.

const g = globalThis as Record<string, unknown>;
if (!Array.isArray(g.__firebaseModulesEvaluated)) {
	g.__firebaseModulesEvaluated = [];
}
(g.__firebaseModulesEvaluated as string[]).push('firebase/app');

export function initializeApp(_config: unknown): unknown {
	return { name: '[DEFAULT]' };
}

export function getApps(): unknown[] {
	return [];
}

export function getApp(): unknown {
	return { name: '[DEFAULT]' };
}
