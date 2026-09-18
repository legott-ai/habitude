// Lazy Firebase app bootstrap.
//
// Top-level is types-only on purpose: free users (cloud sync off) must load
// zero Firebase bytes. The SDK is pulled in via dynamic import() ONLY when
// the user enables cloud sync AND completes the config — with esbuild's CJS
// output the require() runs at first call, not at plugin load.

import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { FirebaseWebConfig } from './config';

let app: FirebaseApp | null = null;

/**
 * Return the shared Firebase app, initializing it on first use.
 * Never called unless cloud sync is enabled with a complete config.
 */
export async function getFirebaseApp(config: FirebaseWebConfig): Promise<FirebaseApp> {
	if (app) return app;
	const { initializeApp, getApps, getApp } = await import('firebase/app');
	app = getApps().length > 0 ? getApp() : initializeApp(config as FirebaseOptions);
	return app;
}
