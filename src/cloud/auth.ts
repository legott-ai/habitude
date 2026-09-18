// Email/password authentication (lazy Firebase Auth).
//
// Google sign-in is intentionally NOT shipped: signInWithPopup/Redirect
// cannot complete a redirect back into Obsidian's Electron shell, so any
// shipped button would be broken. The settings UI shows an honest disabled
// "Google sign-in (coming soon)" button instead — never a broken one.

import type { Auth, User } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';

/** Minimal user surface the plugin needs. */
export interface CloudUser {
	uid: string;
	email: string | null;
}

let auth: Auth | null = null;

async function getAuth(app: FirebaseApp): Promise<Auth> {
	if (auth) return auth;
	const { getAuth } = await import('firebase/auth');
	auth = getAuth(app);
	return auth;
}

function toCloudUser(u: User): CloudUser {
	return { uid: u.uid, email: u.email };
}

export async function cloudSignUp(app: FirebaseApp, email: string, password: string): Promise<CloudUser> {
	const a = await getAuth(app);
	const { createUserWithEmailAndPassword } = await import('firebase/auth');
	const cred = await createUserWithEmailAndPassword(a, email, password);
	return toCloudUser(cred.user);
}

export async function cloudSignIn(app: FirebaseApp, email: string, password: string): Promise<CloudUser> {
	const a = await getAuth(app);
	const { signInWithEmailAndPassword } = await import('firebase/auth');
	const cred = await signInWithEmailAndPassword(a, email, password);
	return toCloudUser(cred.user);
}

export async function cloudSignOut(app: FirebaseApp): Promise<void> {
	const a = await getAuth(app);
	const { signOut } = await import('firebase/auth');
	await signOut(a);
}

export async function onCloudAuthStateChanged(
	app: FirebaseApp,
	cb: (user: CloudUser | null) => void,
): Promise<() => void> {
	const a = await getAuth(app);
	const { onAuthStateChanged } = await import('firebase/auth');
	return onAuthStateChanged(a, (u) => cb(u ? toCloudUser(u) : null));
}

/** Map common Firebase Auth error codes to short user-facing sentences. */
export function cloudAuthErrorMessage(err: unknown): string {
	const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
	switch (code) {
		case 'auth/invalid-email':
			return 'That email address looks invalid.';
		case 'auth/user-not-found':
		case 'auth/wrong-password':
		case 'auth/invalid-credential':
			return 'Wrong email or password.';
		case 'auth/email-already-in-use':
			return 'That email is already registered. Try signing in.';
		case 'auth/weak-password':
			return 'That password is too weak (min 6 characters).';
		case 'auth/network-request-failed':
			return 'Network error. Check your connection and try again.';
		case 'auth/too-many-requests':
			return 'Too many attempts. Wait a bit and try again.';
		default:
			return err instanceof Error && err.message ? err.message : 'Sign-in failed.';
	}
}
