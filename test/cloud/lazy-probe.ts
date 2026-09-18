// Lazy probe: importing getFirebaseApp must NOT evaluate firebase/app;
// calling it MUST (proving the lazy wiring works end-to-end through the
// real src/cloud/firebase.ts).
//
// Build & run (same firebase aliases as load-probe.ts):
//   esbuild test/cloud/lazy-probe.ts --bundle --platform=node \
//     --alias:firebase/app=./test/cloud/mock-firebase-app.ts \
//     --alias:firebase/auth=./test/cloud/mock-firebase-auth.ts \
//     --alias:firebase/firestore=./test/cloud/mock-firebase-firestore.ts \
//     --outfile=test/cloud/dist/lazy-probe.cjs --format=cjs --log-level=warning \
//   && node test/cloud/dist/lazy-probe.cjs

import { getFirebaseApp } from '../../src/cloud/firebase';

async function main(): Promise<void> {
	const before = (globalThis as Record<string, unknown>).__firebaseModulesEvaluated as string[] | undefined;
	if (before && before.length > 0) {
		console.log(`  FAIL firebase/app evaluated at import time: ${before.join(', ')}`);
		process.exitCode = 1;
		return;
	}
	console.log('  PASS firebase/app not evaluated at import time');

	await getFirebaseApp({ apiKey: 'x', authDomain: 'x', projectId: 'x', appId: 'x' });
	const after = (globalThis as Record<string, unknown>).__firebaseModulesEvaluated as string[] | undefined;
	if (after && after.includes('firebase/app')) {
		console.log('  PASS firebase/app loaded lazily on first use');
	} else {
		console.log('  FAIL firebase/app was not loaded by getFirebaseApp()');
		process.exitCode = 1;
	}
}

void main();
