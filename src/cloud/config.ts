// Firebase web-config plumbing.
//
// The config lives in plugin settings (filled in by the user from the
// Firebase console). ALL fields are EMPTY by default: nothing is sent
// anywhere until the user opts in AND completes the config.
//
// Public-repo hygiene: the values stay in the user's local data.json and
// are never committed. See README.md (Privacy) for where to get them.

import type { PluginSettings } from '../types';

/** Firebase web config (Firebase console → Project settings → Your apps). */
export interface FirebaseWebConfig {
	apiKey: string;
	authDomain: string;
	projectId: string;
	appId: string;
	storageBucket?: string;
	messagingSenderId?: string;
}

/** Required config fields, in settings-key order. */
const REQUIRED_FIELDS = [
	{ key: 'cloudApiKey', label: 'API key' },
	{ key: 'cloudAuthDomain', label: 'Auth domain' },
	{ key: 'cloudProjectId', label: 'Project ID' },
	{ key: 'cloudAppId', label: 'App ID' },
] as const;

export function getFirebaseWebConfig(s: PluginSettings): FirebaseWebConfig {
	const cfg: FirebaseWebConfig = {
		apiKey: s.cloudApiKey.trim(),
		authDomain: s.cloudAuthDomain.trim(),
		projectId: s.cloudProjectId.trim(),
		appId: s.cloudAppId.trim(),
	};
	const bucket = s.cloudStorageBucket.trim();
	const sender = s.cloudMessagingSenderId.trim();
	if (bucket) cfg.storageBucket = bucket;
	if (sender) cfg.messagingSenderId = sender;
	return cfg;
}

/**
 * Labels of required config fields that are still empty.
 * Empty array = config is complete and init may proceed.
 */
export function validateFirebaseWebConfig(s: PluginSettings): string[] {
	const missing: string[] = [];
	for (const f of REQUIRED_FIELDS) {
		const v = s[f.key];
		if (typeof v !== 'string' || v.trim() === '') missing.push(f.label);
	}
	return missing;
}

function newDeviceId(): string {
	try {
		// Obsidian runs on modern Chromium/Electron: randomUUID is available.
		return crypto.randomUUID();
	} catch {
		return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	}
}

/**
 * Return the stored per-device id, generating and storing one on first use.
 * The caller must persist settings afterwards.
 */
export function ensureDeviceId(s: PluginSettings): string {
	if (!s.cloudDeviceId) {
		s.cloudDeviceId = newDeviceId();
	}
	return s.cloudDeviceId;
}
