/**
 * Deterministic, in-page friction audit.
 *
 * Runs inside the real browser and returns findings with the offending
 * element's bounding box, so pins are measured geometry — never guessed by a
 * model. Percentages are relative to the captured viewport screenshot.
 *
 * The checks are context-aware on two axes, because a finding that is real on
 * one screen is noise on another:
 *   - stage kind: a category/listing page is *supposed* to have no add-to-cart
 *     control, so demanding one there produced false findings.
 *   - device: the 44×44 tap-target minimum is a touch guideline. On a desktop
 *     pointer it does not apply; only genuinely tiny click targets matter.
 */

/**
 * @param {string} kind    stage kind (listing, detail, options, cart, ...)
 * @param {string} device  "desktop" | "mobile" | "tablet"
 */
export const FRICTION_SCRIPT = (kind = "other", device = "desktop") => `(() => {
  const STAGE = ${JSON.stringify(kind)};
  const DEVICE = ${JSON.stringify(device)};
  const TOUCH = DEVICE !== 'desktop';

  // Where a buy control is genuinely expected. A listing or category grid
  // legitimately has none — its job is to get you to a detail page.
  const BUY_STAGES = ['product', 'detail', 'variant', 'options', 'summary'];
  const expectsBuy = BUY_STAGES.indexOf(STAGE) !== -1;

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

  // 1. Primary action placement — only judged where a buy control belongs.
  const cta = clickable.find((el) => /add to (cart|bag|basket)|buy now|checkout|reserve|book now|select (cabin|room|fare|stateroom)|continue/i.test(el.textContent || el.value || ''));
  if (cta) {
    const r = cta.getBoundingClientRect();
    if (r.top + window.scrollY > window.innerHeight) {
      push(cta, 'high', 'clarity', 'Primary action starts below the fold',
        'The primary action is not visible without scrolling on a ' + window.innerWidth + '×' + window.innerHeight + ' viewport.',
        Math.round(r.top + window.scrollY) + 'px from the top of the document.');
    }
  } else if (expectsBuy) {
    const h = document.querySelector('h1');
    if (h) push(h, 'high', 'clarity', 'No way to proceed from this step',
      'This step shows a single item but exposes no visible add-to-cart, book, reserve, or continue affordance.',
      'Scanned ' + clickable.length + ' interactive elements.');
  } else if (STAGE === 'listing' || STAGE === 'category') {
    // A listing should at least make its items openable.
    const productLinks = clickable.filter((el) => /\\/(products?|p|item|dp|shop|cruise|sailing|itinerar)\\//i.test(el.getAttribute('href') || ''));
    const h = document.querySelector('h1');
    if (h && productLinks.length === 0) {
      push(h, 'medium', 'clarity', 'No obvious product links on this listing',
        'Nothing on this listing resolves to a recognisable detail URL, so shoppers (and crawlers) have no clear next step.',
        'Scanned ' + clickable.length + ' interactive elements.');
    }
  }

  // 2. Click / tap target size — touch guideline on touch devices only.
  const minH = TOUCH ? 32 : 20;
  const maxW = TOUCH ? 120 : 80;
  clickable.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.height < minH && r.width < maxW && (el.textContent || '').trim().length > 0;
  }).slice(0, 3).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (TOUCH) {
      push(el, 'medium', 'accessibility', 'Tap target under 44px',
        'Interactive element is ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px, below the 44×44 touch minimum.',
        (el.textContent || '').trim().slice(0, 60) || selectorFor(el));
    } else {
      push(el, 'low', 'accessibility', 'Very small click target',
        'Interactive element is ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px on a desktop pointer, which is hard to hit accurately.',
        (el.textContent || '').trim().slice(0, 60) || selectorFor(el));
    }
  });

  // 3. Unlabelled form fields — relevant wherever input is collected.
  [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(visible).filter((el) => {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder')) return false;
    return !(el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]'));
  }).slice(0, 3).forEach((el) => {
    push(el, 'medium', 'form', 'Form field without an accessible label',
      'The field exposes no label, aria-label, or placeholder, so assistive tech announces it as unlabelled.',
      selectorFor(el));
  });

  // 4. Quantity control — only meaningful on a buy step that has a buy control.
  const hasQty = [...document.querySelectorAll('input,select,button,[role="spinbutton"]')].some((el) =>
    /qty|quantity/i.test((el.name || '') + (el.id || '') + (el.getAttribute('aria-label') || '')));
  if (expectsBuy && cta && !hasQty) {
    push(cta, 'low', 'clarity', 'No quantity control before add-to-cart',
      'Shoppers who want more than one unit must add-to-cart then edit the cart, adding a round trip.',
      'No quantity input, stepper, or select found near the buy box.');
  }

  // 5. Trust signals near the decision point (buy steps and cart only).
  const bodyText = document.body.innerText || '';
  if ((expectsBuy || STAGE === 'cart' || STAGE === 'checkout') && cta &&
      !/free (shipping|returns)|money.back|secure checkout|30.day|guarantee/i.test(bodyText)) {
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
