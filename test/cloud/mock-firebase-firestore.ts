// Test double for 'firebase/firestore'. Records evaluation; stubs the
// surface the plugin uses. No network.

const g = globalThis as Record<string, unknown>;
if (!Array.isArray(g.__firebaseModulesEvaluated)) {
	g.__firebaseModulesEvaluated = [];
}
(g.__firebaseModulesEvaluated as string[]).push('firebase/firestore');

export function getFirestore(_app: unknown): unknown {
	return { name: 'mock-firestore' };
}

export function doc(_db: unknown, ...segments: string[]): { path: string } {
	return { path: segments.join('/') };
}

export function collection(_db: unknown, ...segments: string[]): { path: string } {
	return { path: segments.join('/') };
}

export function getDoc(_ref: unknown): Promise<{ exists: () => boolean; data: () => unknown }> {
	return Promise.resolve({ exists: () => false, data: () => undefined });
}

export function getDocs(_ref: unknown): Promise<{ forEach: (cb: (d: { id: string; data: () => unknown }) => void) => void }> {
	return Promise.resolve({ forEach: () => undefined });
}

export function setDoc(_ref: unknown, _data: unknown, _opts?: unknown): Promise<void> {
	return Promise.resolve();
}
