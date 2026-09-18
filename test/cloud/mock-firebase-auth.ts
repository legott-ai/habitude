// Test double for 'firebase/auth'. Records evaluation; stubs the surface
// the plugin uses. No network, no credentials.

const g = globalThis as Record<string, unknown>;
if (!Array.isArray(g.__firebaseModulesEvaluated)) {
	g.__firebaseModulesEvaluated = [];
}
(g.__firebaseModulesEvaluated as string[]).push('firebase/auth');

export function getAuth(_app: unknown): unknown {
	return { name: 'mock-auth' };
}

export function createUserWithEmailAndPassword(
	_auth: unknown,
	email: string,
	_password: string,
): Promise<{ user: { uid: string; email: string } }> {
	return Promise.resolve({ user: { uid: 'mock-uid', email } });
}

export function signInWithEmailAndPassword(
	_auth: unknown,
	email: string,
	_password: string,
): Promise<{ user: { uid: string; email: string } }> {
	return Promise.resolve({ user: { uid: 'mock-uid', email } });
}

export function signOut(_auth: unknown): Promise<void> {
	return Promise.resolve();
}

export function onAuthStateChanged(
	_auth: unknown,
	cb: (u: { uid: string; email: string } | null) => void,
): () => void {
	cb(null);
	return () => undefined;
}
