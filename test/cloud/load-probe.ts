// Load probe: bundles the REAL src/main.ts (firebase/* aliased to the
// evaluation-recording mocks) and requires it. With cloud sync never
// enabled, NO firebase module may be evaluated at plugin load.
//
// Build & run (firebase aliases point at the mocks):
//   esbuild test/cloud/load-probe.ts --bundle --platform=node \
//     --alias:obsidian=./test/stress/mock-obsidian.ts \
//     --alias:firebase/app=./test/cloud/mock-firebase-app.ts \
//     --alias:firebase/auth=./test/cloud/mock-firebase-auth.ts \
//     --alias:firebase/firestore=./test/cloud/mock-firebase-firestore.ts \
//     --outfile=test/cloud/dist/load-probe.cjs --format=cjs --log-level=warning \
//   && node test/cloud/dist/load-probe.cjs

import '../../src/main';

const seen = (globalThis as Record<string, unknown>).__firebaseModulesEvaluated as string[] | undefined;
if (seen && seen.length > 0) {
	console.log(`  FAIL firebase modules evaluated at plugin load: ${seen.join(', ')}`);
	process.exitCode = 1;
} else {
	console.log('  PASS no firebase module evaluated at plugin load (cloud disabled)');
}
