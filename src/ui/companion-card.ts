import { t } from '../i18n';
import type { CompanionEntryPoint } from '../companion';

export interface CompanionCardOptions {
	entryPoint: CompanionEntryPoint;
	reason: 'start' | 'review' | 'coach';
	onExplore: () => void;
	onDismiss: () => void;
}

/** A local, dismissible invitation. Only the modal can open the website. */
export function renderCompanionCard(host: HTMLElement, options: CompanionCardOptions): void {
	const card = host.createDiv({ cls: 'habitude-companion-card' });
	const copy = card.createDiv({ cls: 'habitude-companion-card-copy' });
	copy.createEl('strong', { text: t(`companion.card.${options.reason}.title`) });
	copy.createEl('p', { text: t(`companion.card.${options.reason}.body`) });
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
