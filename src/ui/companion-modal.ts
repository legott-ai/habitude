import { Modal, type App } from 'obsidian';
import { buildCompanionUrl, COMPANION_PLANS, type CompanionEntryPoint } from '../companion';
import { t } from '../i18n';

type BillingPeriod = 'monthly' | 'annual';
let modalSequence = 0;

/** Local plan preview. No account, checkout, or connection is fabricated here. */
export class CompanionModal extends Modal {
	private billingPeriod: BillingPeriod = 'monthly';
	private readonly instanceId = `habitude-companion-${++modalSequence}`;

	constructor(app: App, private readonly entryPoint: CompanionEntryPoint, private readonly onExport?: () => void) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.empty();
		this.modalEl.addClass('habitude-companion-modal');
		this.contentEl.addClass('habitude-companion');
		this.setTitle(t('companion.title'));
		this.contentEl.createEl('p', {
			text: t('companion.intro'),
			cls: 'habitude-companion-intro',
		});

		const current = this.contentEl.createEl('section', { cls: 'habitude-companion-current' });
		current.createEl('h3', { text: t('companion.current.title') });
		current.createEl('p', { text: t('companion.current.body') });

		const planHeader = this.contentEl.createDiv({ cls: 'habitude-companion-plan-header' });
		planHeader.createEl('h3', { text: t('companion.plans.title') });
		planHeader.createEl('p', { text: t('companion.plans.status') });
		const billing = this.contentEl.createEl('fieldset', { cls: 'habitude-companion-billing' });
		billing.createEl('legend', { text: t('companion.billing.label') });
		const prices = new Map<string, { amount: HTMLElement; period: HTMLElement }>();
		for (const period of ['monthly', 'annual'] as const) {
			const label = billing.createEl('label', { cls: 'habitude-companion-billing-option' });
			const input = label.createEl('input', {
				attr: {
					type: 'radio',
					name: `${this.instanceId}-billing`,
					value: period,
				},
			});
			input.checked = this.billingPeriod === period;
			label.createSpan({ text: t(`companion.billing.${period}`) });
			input.onchange = () => {
				if (!input.checked) return;
				this.billingPeriod = period;
				this.updatePrices(prices);
			};
		}

		const plans = this.contentEl.createDiv({ cls: 'habitude-companion-plans' });
		for (const plan of COMPANION_PLANS) {
			const card = plans.createEl('section', { cls: 'habitude-companion-plan' });
			const heading = card.createDiv({ cls: 'habitude-companion-plan-heading' });
			heading.createEl('h4', { text: plan.name });
			heading.createSpan({
				text: t(`companion.plan.${plan.status}`),
				cls: 'habitude-companion-badge',
			});
			const price = card.createDiv({ cls: 'habitude-companion-price', attr: { 'aria-live': 'polite' } });
			const amount = price.createEl('strong');
			const period = price.createSpan();
			prices.set(plan.id, { amount, period });
			const list = card.createEl('ul');
			if (plan.id === 'free') {
				list.createEl('li', { text: t('companion.plan.free.local') });
				list.createEl('li', { text: t('companion.plan.free.review') });
				list.createEl('li', { text: t('companion.plan.free.coach') });
			} else {
				list.createEl('li', { text: t('companion.plan.sync') });
				list.createEl('li', { text: t('companion.plan.storage', { amount: plan.storageGiB }) });
				list.createEl('li', { text: t('companion.plan.sources', { count: plan.sources }) });
				if (plan.weightedCredits > 0) {
					list.createEl('li', { text: t('companion.plan.analysis') });
					list.createEl('li', { text: t('companion.plan.credits', { count: plan.weightedCredits }) });
				} else {
					list.createEl('li', { text: t('companion.plan.noCredits') });
				}
			}
			card.createEl('p', {
				text: t(plan.id === 'free' ? 'companion.plan.free.note' : 'companion.plan.plannedNote'),
				cls: 'habitude-companion-plan-note',
			});
		}
		this.updatePrices(prices);
		this.contentEl.createEl('p', { text: t('companion.plans.note'), cls: 'habitude-companion-note' });

		const privacy = this.contentEl.createEl('section', { cls: 'habitude-companion-privacy' });
		privacy.createEl('h3', { text: t('companion.privacy.title') });
		privacy.createEl('p', { text: t('companion.privacy.data') });
		privacy.createEl('p', { text: t('companion.privacy.website') });
		privacy.createEl('p', { text: t('companion.privacy.serviceStatus') });
		if (this.onExport) {
			const transfer = this.contentEl.createDiv({ cls: 'habitude-companion-current' });
			transfer.createEl('h3', { text: t('transfer.title') });
			transfer.createEl('p', { text: t('transfer.settingsDesc') });
			const button = transfer.createEl('button', { text: t('transfer.preview') });
			button.onclick = () => { this.close(); this.onExport?.(); };
		}

		const actions = this.contentEl.createDiv({ cls: 'habitude-companion-actions' });
		this.createExternalLink(actions);
		const close = actions.createEl('button', {
			text: t('companion.close'),
			attr: { type: 'button' },
		});
		close.onclick = () => this.close();
		this.contentEl.createEl('p', { text: t('companion.externalHint'), cls: 'habitude-companion-note' });
	}

	private updatePrices(prices: Map<string, { amount: HTMLElement; period: HTMLElement }>): void {
		for (const plan of COMPANION_PLANS) {
			const elements = prices.get(plan.id);
			if (!elements) continue;
			const amount = this.billingPeriod === 'annual' ? plan.annualUsd : plan.monthlyUsd;
			elements.amount.setText(`$${amount.toFixed(2)} USD`);
			elements.period.setText(t(plan.id === 'free' ? 'companion.price.free' : `companion.price.${this.billingPeriod}`));
		}
	}

	private createExternalLink(host: HTMLElement): void {
		host.createEl('a', {
			text: t('companion.explore'),
			cls: 'habitude-companion-link mod-cta',
			attr: {
				href: buildCompanionUrl(this.entryPoint, 'explore'),
				target: '_blank',
				rel: 'noopener noreferrer',
				'aria-label': `${t('companion.explore')} — ${t('companion.externalHint')}`,
			},
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
