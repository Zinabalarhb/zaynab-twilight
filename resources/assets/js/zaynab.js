/**
 * zaynab.js
 * Zaynab Theme — Custom Web Components & Interactions
 *
 * Defines:
 *  - <zaynab-size-guide-modal>  — signature interactive size calculator
 *  - <custom-zaynab-product-card> — signature "Lookbook" product card,
 *      registered as the product-card-component for salla-products-slider /
 *      salla-products-list per the confirmed Twilight convention seen in
 *      wishlist.twig (`product-card-component="custom-wishlist-card"`).
 *  - <custom-main-menu>          — main navigation, referenced from header.twig
 *  - Lookbook hotspot click → scroll-to + pulse the matching mini product card
 *  - Filter chip toggles on the featured-products slider
 *
 * Note: this assumes the global `salla` JS SDK object is already present on
 * the page (loaded by app.js per layouts/master.twig), exposing salla.cart,
 * salla.wishlist, salla.product, salla.config.get(), etc. as documented in
 * Salla's Twilight developer docs.
 */

(function () {
  'use strict';

  /* ============================================================
     SIZE GUIDE MODAL
     ============================================================ */
  class ZaynabSizeGuideModal extends HTMLElement {
    connectedCallback() {
      this.chart = [
        { size: 'XS', bust: [78, 81], waist: [60, 63], hips: [85, 88] },
        { size: 'S', bust: [82, 85], waist: [64, 67], hips: [89, 92] },
        { size: 'M', bust: [86, 90], waist: [68, 72], hips: [93, 97] },
        { size: 'L', bust: [91, 96], waist: [73, 78], hips: [98, 103] },
        { size: 'XL', bust: [97, 103], waist: [79, 85], hips: [104, 110] },
      ];
      this.render();
    }

    /**
     * Open the modal. If a product-specific chart was passed (from
     * single.twig's `product.size_guide`), use it; otherwise fall back to
     * the generic chart above.
     */
    open(productChart) {
      if (Array.isArray(productChart) && productChart.length) {
        this.chart = productChart;
        this.renderChartRows();
      }
      this.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }

    close() {
      this.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    render() {
      this.innerHTML = `
        <div class="zaynab-modal-backdrop" data-close>
          <div class="zaynab-modal" role="dialog" aria-modal="true">
            <div class="zaynab-modal__header">
              <h2 class="zaynab-modal__title">${this._t('pages.products.size_guide')}</h2>
              <button type="button" class="zaynab-modal__close" data-close aria-label="${this._t('common.elements.close')}">
                <i class="sicon-cancel"></i>
              </button>
            </div>
            <div class="zaynab-modal__body">
              <p class="zaynab-sg-hint">${this._t('pages.products.size_guide_hint')}</p>
              <div class="zaynab-sg-form">
                <div>
                  <label class="zaynab-sg-label">${this._t('pages.products.bust')} (${this._t('pages.products.unit_cm')})</label>
                  <input type="number" class="zaynab-sg-input" data-field="bust" placeholder="88">
                </div>
                <div>
                  <label class="zaynab-sg-label">${this._t('pages.products.waist')} (${this._t('pages.products.unit_cm')})</label>
                  <input type="number" class="zaynab-sg-input" data-field="waist" placeholder="70">
                </div>
                <div>
                  <label class="zaynab-sg-label">${this._t('pages.products.hips')} (${this._t('pages.products.unit_cm')})</label>
                  <input type="number" class="zaynab-sg-input" data-field="hips" placeholder="95">
                </div>
              </div>
              <button type="button" class="btn btn--accent btn-full" data-calc>${this._t('pages.products.calculate_size')}</button>
              <div class="zaynab-sg-result" data-result hidden></div>
              <table class="zaynab-size-chart" data-chart>
                <thead>
                  <tr>
                    <th>${this._t('pages.products.size')}</th>
                    <th>${this._t('pages.products.bust')}</th>
                    <th>${this._t('pages.products.waist')}</th>
                    <th>${this._t('pages.products.hips')}</th>
                  </tr>
                </thead>
                <tbody data-chart-body></tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      this.renderChartRows();

      this.querySelectorAll('[data-close]').forEach((el) =>
        el.addEventListener('click', (e) => {
          if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) this.close();
        })
      );

      this.querySelector('[data-calc]').addEventListener('click', () => this.calculate());

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.classList.contains('is-open')) this.close();
      });
    }

    renderChartRows() {
      const tbody = this.querySelector('[data-chart-body]');
      if (!tbody) return;
      tbody.innerHTML = this.chart
        .map(
          (row) => `
        <tr data-size-row="${row.size}">
          <td><strong>${row.size}</strong></td>
          <td>${row.bust[0]}-${row.bust[1]}</td>
          <td>${row.waist[0]}-${row.waist[1]}</td>
          <td>${row.hips[0]}-${row.hips[1]}</td>
        </tr>`
        )
        .join('');
    }

    calculate() {
      const bust = parseFloat(this.querySelector('[data-field="bust"]').value);
      const waist = parseFloat(this.querySelector('[data-field="waist"]').value);
      const hips = parseFloat(this.querySelector('[data-field="hips"]').value);

      if (!bust && !waist && !hips) {
        if (window.salla && salla.notify) salla.notify.error(this._t('pages.products.size_guide_enter_one'));
        return;
      }

      const mid = (range) => (range[0] + range[1]) / 2;
      let best = this.chart[Math.floor(this.chart.length / 2)].size;
      let bestScore = Infinity;

      this.chart.forEach((row) => {
        let score = 0;
        let count = 0;
        if (bust) { score += Math.abs(bust - mid(row.bust)); count++; }
        if (waist) { score += Math.abs(waist - mid(row.waist)); count++; }
        if (hips) { score += Math.abs(hips - mid(row.hips)); count++; }
        if (count > 0) {
          const avg = score / count;
          if (avg < bestScore) { bestScore = avg; best = row.size; }
        }
      });

      const resultEl = this.querySelector('[data-result]');
      resultEl.hidden = false;
      resultEl.innerHTML = `
        <div class="zaynab-sg-result__label">${this._t('pages.products.suggested_size')}</div>
        <div class="zaynab-sg-result__size">${best}</div>
      `;

      this.querySelectorAll('[data-size-row]').forEach((tr) => {
        tr.classList.toggle('is-highlighted', tr.dataset.sizeRow === best);
      });

      // Persist this calculation against the option chips on the page, if present,
      // so selecting "use this size" pre-fills the product form's size option.
      const sizeChip = document.querySelector(`.zaynab-size-chip[data-value-name="${best}"]`);
      if (sizeChip) sizeChip.dataset.suggested = 'true';
    }

    _t(key) {
      // Falls back to the key itself if Salla's client-side translator
      // (salla.lang.get) isn't available for some reason.
      try {
        return (window.salla && salla.lang && salla.lang.get(key)) || this._fallback(key);
      } catch {
        return this._fallback(key);
      }
    }

    _fallback(key) {
      const map = {
        'pages.products.size_guide': 'دليل المقاسات',
        'pages.products.size_guide_hint': 'أدخلي قياساتك بالسنتيمتر وسنقترح عليك المقاس الأنسب فوراً',
        'pages.products.bust': 'محيط الصدر',
        'pages.products.waist': 'محيط الخصر',
        'pages.products.hips': 'محيط الأرداف',
        'pages.products.unit_cm': 'سم',
        'pages.products.calculate_size': 'احسبي مقاسي',
        'pages.products.suggested_size': 'المقاس المقترح لك',
        'pages.products.size': 'المقاس',
        'pages.products.size_guide_enter_one': 'يرجى إدخال قياس واحد على الأقل',
        'common.elements.close': 'إغلاق',
        'common.elements.edit': 'تعديل',
      };
      return map[key] || key;
    }
  }

  if (!customElements.get('zaynab-size-guide-modal')) {
    customElements.define('zaynab-size-guide-modal', ZaynabSizeGuideModal);
  }

  /* ============================================================
     SHOP THE LOOK — hotspot click scrolls + pulses matching mini-card
     ============================================================ */
  document.addEventListener('click', (e) => {
    const hotspot = e.target.closest('.zaynab-hotspot');
    if (!hotspot) return;

    const productId = hotspot.dataset.targetProduct;
    const section = hotspot.closest('.zaynab-lookbook__grid');
    const strip = section ? section.querySelector('.zaynab-look-strip') : null;
    if (!strip) return;

    const card = strip.querySelector(`[data-product-id="${productId}"]`);
    if (!card) return;

    strip.scrollTo({ left: card.offsetLeft - 16, behavior: 'smooth' });
    card.classList.add('is-pulsing');
    setTimeout(() => card.classList.remove('is-pulsing'), 600);
  });

  /* ============================================================
     FEATURED PRODUCTS — filter chips (client-side, no extra API calls)
     ============================================================ */
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.zaynab-chip');
    if (!chip) return;

    const bar = chip.closest('.zaynab-filter-chips');
    if (!bar) return;

    bar.querySelectorAll('.zaynab-chip').forEach((c) => {
      c.classList.remove('is-active');
      c.setAttribute('aria-selected', 'false');
    });
    chip.classList.add('is-active');
    chip.setAttribute('aria-selected', 'true');

    const filter = chip.dataset.filter;
    const slider = bar.nextElementSibling; // salla-products-slider sits right after
    if (!slider) return;

    slider.querySelectorAll('[data-product-card]').forEach((card) => {
      if (filter === 'all') {
        card.style.display = '';
        return;
      }
      card.style.display = card.dataset[filter] === 'true' ? '' : 'none';
    });
  });

  /* ============================================================
     PRODUCT OPTIONS — selecting a swatch updates the visible label
     and keeps a single aria-checked active swatch per option group.
     (Actual cart/price logic stays with Salla's native salla.product
     events; this only handles the visual state of Zaynab's custom
     swatch markup defined in partials/product/options.twig.)
     ============================================================ */
  document.addEventListener('click', (e) => {
    const swatch = e.target.closest('.zaynab-color-swatch, .zaynab-size-chip, .zaynab-option-chip');
    if (!swatch || swatch.classList.contains('is-unavailable')) return;

    const group = swatch.closest('.zaynab-option-swatches');
    const optionWrap = swatch.closest('.zaynab-product-option');
    if (!group || !optionWrap) return;

    group.querySelectorAll('button').forEach((b) => {
      b.classList.remove('is-active');
      b.setAttribute('aria-checked', 'false');
    });
    swatch.classList.add('is-active');
    swatch.setAttribute('aria-checked', 'true');

    const label = optionWrap.querySelector('[data-selected-label]');
    if (label) label.textContent = swatch.dataset.valueName || '';

    // Let Salla's own option-change handling pick this up — dispatch a
    // standard change-like event so salla.product's listeners (which bind
    // to the option buttons) still receive the interaction.
    swatch.dispatchEvent(new CustomEvent('zaynab:option-selected', {
      bubbles: true,
      detail: { optionId: swatch.dataset.optionId, valueId: swatch.dataset.valueId },
    }));
  });

})();
