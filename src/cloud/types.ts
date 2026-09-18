// Shared cloud-sync data contract.
//
// These types mirror the backend contract exactly:
//
//   users/{uid}/habits/{habitId}
//     { title, schedule, createdAt, archived, updatedAt }
//   users/{uid}/dailyLogs/{YYYY-MM-DD}
//     { checks: { [habitId]: { done, updatedAt, deviceId } }, updatedAt }
//   users/{uid}/entitlement
//     { plan, status, stripeCustomerId, currentPeriodEnd, updatedAt }
//
// Allowlist rule: the sync payload NEVER contains note/journal markdown,
// filenames, or vault paths — only the fields declared here.

/** Habit document synced to users/{uid}/habits/{habitId}. */
export interface CloudHabitDoc {
	title: string;
	schedule: string;
	/** ISO date string (YYYY-MM-DD) */
	createdAt: string;
	archived: boolean;
	/** ISO timestamp of the last write */
	updatedAt: string;
}

/** One synced check entry. */
export interface CloudCheckEntry {
	done: boolean;
	/** ISO timestamp; last-write-wins on merge */
	updatedAt: string;
	/** writer device id; tiebreak when updatedAt is equal */
	deviceId: string;
}

/** Daily-log document synced to users/{uid}/dailyLogs/{YYYY-MM-DD}. */
export interface CloudDailyLogDoc {
	checks: Record<string, CloudCheckEntry>;
	/** ISO timestamp of the last write */
	updatedAt: string;
}

export type EntitlementPlan = 'free' | 'premium';
export type EntitlementStatus = 'active' | 'past_due' | 'canceled' | 'incomplete';

/** Entitlement document synced at users/{uid}/entitlement. */
export interface Entitlement {
	plan: EntitlementPlan;
	status: EntitlementStatus;
	stripeCustomerId: string | null;
	currentPeriodEnd: string | null;
	updatedAt: string;
}
