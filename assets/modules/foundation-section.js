import { APP_VERSION } from './config.js';
import { t } from './i18n.js';

function renderTag(label) {
  return `<span class="foundation-tag">${label}</span>`;
}

function renderCard({ icon, titleKey, bodyKey, detail }) {
  return `
    <article class="foundation-card">
      <div class="foundation-card__icon" aria-hidden="true">${icon}</div>
      <div class="foundation-card__content">
        <h3>${t(titleKey)}</h3>
        <p>${t(bodyKey)}</p>
        ${detail ? `<div class="foundation-card__detail">${detail}</div>` : ''}
      </div>
    </article>
  `;
}

export function renderFoundationSection() {
  const scientificDetail = `
    <div class="foundation-reference">
      <span class="foundation-reference__label">${t('footer.scientificReferenceLabel')}</span>
      <strong>${t('footer.scientificReferenceTitle')}</strong>
      <span>${t('footer.scientificReferenceMeta')}</span>
    </div>
  `;

  const authorshipDetail = `
    <div class="foundation-authorship">
      <strong>${t('footer.authorshipCreator')}</strong>
      <span>${t('footer.authorshipRole')}</span>
    </div>
  `;

  const privacyDetail = `
    <ul class="foundation-mini-list">
      <li>${t('footer.privacyPointLocal')}</li>
      <li>${t('footer.privacyPointPseudonymized')}</li>
      <li>${t('footer.privacyPointResearch')}</li>
    </ul>
  `;

  const ipDetail = `
    <div class="foundation-ip">
      <strong>${t('footer.ipNotice')}</strong>
      <span>${t('footer.ipRights')}</span>
    </div>
  `;

  const cards = [
    {
      icon: '◎',
      titleKey: 'footer.aboutTitle',
      bodyKey: 'footer.aboutBody'
    },
    {
      icon: '◌',
      titleKey: 'footer.scientificTitle',
      bodyKey: 'footer.scientificBody',
      detail: scientificDetail
    },
    {
      icon: '◍',
      titleKey: 'footer.authorshipTitle',
      bodyKey: 'footer.authorshipBody',
      detail: authorshipDetail
    },
    {
      icon: '◈',
      titleKey: 'footer.disclaimerTitle',
      bodyKey: 'footer.disclaimerBody'
    },
    {
      icon: '◔',
      titleKey: 'footer.privacyTitle',
      bodyKey: 'footer.privacyBody',
      detail: privacyDetail
    },
    {
      icon: '▣',
      titleKey: 'footer.ipTitle',
      bodyKey: 'footer.ipBody',
      detail: ipDetail
    }
  ];

  return `
    <section class="foundation-section" aria-label="${t('footer.sectionTitle')}">
      <div class="foundation-accordion" id="foundationAccordion">
        <button
          class="foundation-accordion__toggle"
          type="button"
          aria-expanded="false"
          aria-controls="foundationAccordionBody"
          onclick="
            var acc = document.getElementById('foundationAccordion');
            var open = acc.classList.toggle('is-open');
            this.setAttribute('aria-expanded', open);
          "
        >
          <span>${t('footer.sectionTitle')}</span>
          <span class="foundation-accordion__chevron" aria-hidden="true">▼</span>
        </button>
        <div class="foundation-accordion__body" id="foundationAccordionBody">
          <div class="foundation-shell">
            <div class="foundation-hero">
              <div>
                <p class="eyebrow foundation-eyebrow">${t('footer.sectionEyebrow')}</p>
                <h2>${t('footer.sectionTitle')}</h2>
                <p class="foundation-intro">${t('footer.sectionIntro')}</p>
              </div>
              <div class="foundation-meta">
                <div class="foundation-version">${APP_VERSION}</div>
                <div class="foundation-tag-row">
                  ${renderTag(t('footer.tagSupport'))}
                  ${renderTag(t('footer.tagScientific'))}
                  ${renderTag(t('footer.tagBilingual'))}
                </div>
              </div>
            </div>

            <div class="foundation-grid">
              ${cards.map(renderCard).join('')}
            </div>

            <div class="foundation-bottom-bar">
              <strong>${t('footer.bottomCreator')}</strong>
              <span>${t('footer.bottomRights')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}
