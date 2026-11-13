import { t } from '../i18n';
import type { CompanionEntryPoint, CompanionReason } from '../companion';

export interface CompanionCardOptions {
	entryPoint: CompanionEntryPoint;
	reason: CompanionReason;
	/** Values for the reason's copy, e.g. the habit and length of a paused run. */
	vars?: Record<string, string | number>;
	onExplore: () => void;
	onDismiss: () => void;
}

/** A local, dismissible invitation. Only the modal can open the website. */
export function renderCompanionCard(host: HTMLElement, options: CompanionCardOptions): void {
	const card = host.createDiv({ cls: 'habitude-companion-card' });
	const copy = card.createDiv({ cls: 'habitude-companion-card-copy' });
	copy.createEl('strong', { text: t(`companion.card.${options.reason}.title`, options.vars) });
	copy.createEl('p', { text: t(`companion.card.${options.reason}.body`, options.vars) });
	const actions = card.createDiv({ cls: 'habitude-companion-card-actions' });
	const explore = actions.createEl('button', {
		text: t('companion.card.explore'),
		attr: { type: 'button' },
	});
	explore.onclick = options.onExplore;
	const dismiss = actions.createEl('button', {
		text: t('companion.card.dismiss'),
		cls: 'habitude-companion-dismiss',
		attr: { type: 'button', 'aria-label': t('companion.card.dismissAria') },
	});
	dismiss.onclick = options.onDismiss;
}
