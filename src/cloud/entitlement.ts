// Premium entitlement: read + gate.
//
// Cloud sync requires plan === 'premium' && status === 'active'. Free users
// get honest upsell copy in settings — no deception, no ads anywhere else.

import type { FirebaseApp } from 'firebase/app';
import type { Entitlement } from './types';

export type { Entitlement };

/**
 * Document id of the single entitlement doc in the users/{uid}/entitlement
 * subcollection. OPEN QUESTION for the backend worker: the shared contract
 * lists the path as users/{uid}/entitlement (odd segment count); this
 * implementation reads doc id "current" under that subcollection. Align if
 * the backend writes a different id.
 */
export const ENTITLEMENT_DOC_ID = 'current';

/** Gate: may this account use cloud sync? Pure — unit-tested. */
export function canEnableCloudSync(ent: Entitlement | null | undefined): boolean {
	return !!ent && ent.plan === 'premium' && ent.status === 'active';
}

/**
 * Fetch the entitlement doc. Missing doc / missing fields / any read error
 * all degrade to a free entitlement (sync stays off) — never throw into
 * the sync loop.
 */
export async function fetchEntitlement(app: FirebaseApp, uid: string): Promise<Entitlement> {
	try {
		const { getFirestore, doc, getDoc } = await import('firebase/firestore');
		const db = getFirestore(app);
		const snap = await getDoc(doc(db, 'users', uid, 'entitlement', ENTITLEMENT_DOC_ID));
		if (!snap.exists()) return freeEntitlement();
		const d = snap.data() as Partial<Entitlement>;
		return {
			plan: d.plan === 'premium' ? 'premium' : 'free',
			status:
				d.status === 'active' ||
				d.status === 'past_due' ||
				d.status === 'canceled' ||
				d.status === 'incomplete'
					? d.status
					: 'incomplete',
			stripeCustomerId: typeof d.stripeCustomerId === 'string' ? d.stripeCustomerId : null,
			currentPeriodEnd: typeof d.currentPeriodEnd === 'string' ? d.currentPeriodEnd : null,
			updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '',
		};
	} catch {
		return freeEntitlement();
	}
}

function freeEntitlement(): Entitlement {
	return {
		plan: 'free',
		status: 'incomplete',
		stripeCustomerId: null,
		currentPeriodEnd: null,
		updatedAt: '',
	};
}
