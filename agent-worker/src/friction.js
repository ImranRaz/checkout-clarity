/**
 * Deterministic, in-page friction audit.
 *
 * Runs inside the real browser and returns findings with the offending
 * element's bounding box, so pins are measured geometry — never guessed by a
 * model. Percentages are relative to the captured viewport screenshot.
 */

export const FRICTION_SCRIPT = `(() => {
  const vw = window.innerWidth;
  const vh = Math.max(document.documentElement.scrollHeight, window.innerHeight);
  const out = [];
  let id = 1;

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };

  const selectorFor = (el) => {
    if (el.id) return '#' + CSS.escape(el.id);
    const cls = (el.className && typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '');
    return el.tagName.toLowerCase() + (cls ? '.' + CSS.escape(cls) : '');
  };

  const push = (el, sev, category, title, description, evidence) => {
    const r = el.getBoundingClientRect();
    out.push({
      id: id++,
      x_percentage: Math.min(100, Math.max(0, ((r.left + r.width / 2) / vw) * 100)),
      y_percentage: Math.min(100, Math.max(0, ((r.top + window.scrollY + r.height / 2) / vh) * 100)),
      severity: sev,
      category,
      title,
      description,
      evidence,
      selector: selectorFor(el),
    });
  };

  const clickable = [...document.querySelectorAll('a,button,[role="button"],input[type="submit"]')].filter(visible);

  // 1. Primary action below the fold.
  const cta = clickable.find((el) => /add to (cart|bag|basket)|buy now|checkout/i.test(el.textContent || el.value || ''));
  if (cta) {
    const r = cta.getBoundingClientRect();
    if (r.top + window.scrollY > window.innerHeight) {
      push(cta, 'high', 'clarity', 'Primary action starts below the fold',
        'The add-to-cart control is not visible without scrolling on a ' + window.innerWidth + '×' + window.innerHeight + ' viewport.',
        Math.round(r.top + window.scrollY) + 'px from the top of the document.');
    }
  } else {
    const h = document.querySelector('h1');
    if (h) push(h, 'high', 'clarity', 'No add-to-cart control found',
      'No visible element on this page matches an add-to-cart or buy-now affordance.',
      'Scanned ' + clickable.length + ' interactive elements.');
  }

  // 2. Tap targets below 44px.
  clickable.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.height < 32 && r.width < 120;
  }).slice(0, 3).forEach((el) => {
    const r = el.getBoundingClientRect();
    push(el, 'medium', 'accessibility', 'Tap target under 44px',
      'Interactive element is ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px, below the 44×44 minimum.',
      (el.textContent || '').trim().slice(0, 60) || selectorFor(el));
  });

  // 3. Unlabelled form fields.
  [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(visible).filter((el) => {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder')) return false;
    return !(el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]'));
  }).slice(0, 3).forEach((el) => {
    push(el, 'medium', 'form', 'Form field without an accessible label',
      'The field exposes no label, aria-label, or placeholder, so assistive tech announces it as unlabelled.',
      selectorFor(el));
  });

  // 4. Quantity control missing on a product page.
  const hasQty = [...document.querySelectorAll('input,select,button,[role="spinbutton"]')].some((el) =>
    /qty|quantity/i.test((el.name || '') + (el.id || '') + (el.getAttribute('aria-label') || '')));
  if (cta && !hasQty) {
    push(cta, 'low', 'clarity', 'No quantity control before add-to-cart',
      'Shoppers who want more than one unit must add-to-cart then edit the cart, adding a round trip.',
      'No quantity input, stepper, or select found near the buy box.');
  }

  // 5. Trust signals near the primary action.
  const bodyText = document.body.innerText || '';
  if (cta && !/free (shipping|returns)|money.back|secure checkout|30.day|guarantee/i.test(bodyText)) {
    push(cta, 'medium', 'trust', 'No trust or returns signal near the buy box',
      'Nothing on the page states shipping cost, returns window, or payment security at the decision point.',
      'Searched page text for shipping, returns, guarantee, and secure-checkout language.');
  }

  // 6. Images without alt text.
  const imgs = [...document.querySelectorAll('img')].filter(visible);
  const noAlt = imgs.filter((el) => !el.getAttribute('alt'));
  if (noAlt.length > 0) {
    push(noAlt[0], 'low', 'accessibility', noAlt.length + ' image' + (noAlt.length > 1 ? 's' : '') + ' missing alt text',
      'Product imagery without alt text is invisible to screen readers and to image search.',
      noAlt.length + ' of ' + imgs.length + ' visible images have no alt attribute.');
  }

  return out;
})()`;
