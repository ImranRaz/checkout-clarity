/**
 * Deterministic, in-page friction audit.
 *
 * Runs inside the real browser and returns findings with the offending
 * element's bounding box, so pins are measured geometry — never guessed by a
 * model. Percentages are relative to the captured screenshot.
 *
 * Precision over recall. Every rule here has to survive the question "would a
 * senior UX reviewer actually write this down?". Three specific false
 * positives shaped the current version:
 *
 *   1. "No add-to-cart" fired on shoe/apparel detail pages where the buy
 *      button is deliberately gated behind a size choice. That is correct,
 *      intentional design, not friction — so a page that exposes a variant
 *      picker or a disabled buy control is treated as having a buy path.
 *   2. When a finding had no obvious anchor the pin landed on the first <h1>,
 *      which on many sites is the header logo. Anchors now resolve inside the
 *      main content region.
 *   3. Tap-target rules were firing per element on desktop, producing five
 *      near-identical "very small click target" rows for a breadcrumb. Small
 *      targets are now grouped into one finding, and on desktop only genuinely
 *      tiny controls count.
 *
 * Subjective, journey-level judgement (is the next step obvious? is the value
 * proposition clear? is the price honest?) is deliberately NOT attempted here.
 * That is the LLM reviewer's job in ux-review.js; this file only reports what
 * can be measured.
 */

/**
 * @param {string} kind    stage kind (listing, detail, options, cart, ...)
 * @param {string} device  "desktop" | "mobile" | "tablet"
 */
export const FRICTION_SCRIPT = (kind = "other", device = "desktop") => `(() => {
  const STAGE = ${JSON.stringify(kind)};
  const DEVICE = ${JSON.stringify(device)};
  const TOUCH = DEVICE !== 'desktop';

  // Where a buy/continue control is genuinely expected. A listing or category
  // grid legitimately has none — its job is to get you to a detail page.
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

  const text = (el) => ((el.innerText || el.textContent || el.value || '') + ' ' + (el.getAttribute('aria-label') || '')).trim();

  const selectorFor = (el) => {
    if (el.id) return '#' + CSS.escape(el.id);
    const cls = (el.className && typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '');
    return el.tagName.toLowerCase() + (cls ? '.' + CSS.escape(cls) : '');
  };

  // Chrome regions. A finding anchored here is almost always mis-anchored,
  // and their controls (breadcrumbs, utility nav) are not journey friction.
  const CHROME = 'header,nav,footer,[role="banner"],[role="navigation"],[role="contentinfo"]';
  const inChrome = (el) => !!el.closest(CHROME);

  const main = document.querySelector('main,[role="main"],#main,#MainContent') || document.body;

  /** Anchor for findings that have no single offending element. */
  const contentAnchor = () => {
    const h = main.querySelector('h1,h2');
    if (h && visible(h) && !inChrome(h)) return h;
    const imgs = [...main.querySelectorAll('img')].filter(visible);
    let best = null, bestArea = 0;
    imgs.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > bestArea) { bestArea = r.width * r.height; best = el; }
    });
    return best || main;
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

  const allInteractive = [...document.querySelectorAll('a,button,[role="button"],[role="radio"],[role="option"],input[type="submit"],input[type="button"],select,summary')];
  const clickable = allInteractive.filter(visible);

  const BUY_RE = /add to (cart|bag|basket)|add to my|buy now|buy it now|checkout|reserve|book now|select (a )?(size|cabin|room|fare|stateroom|date)|choose (a )?(size|option)|continue|proceed|next step|get started|customi[sz]e|configure|sold out|out of stock|notify me/i;

  // ---------------------------------------------------------------------
  // 1. Is there a way to proceed? Judged generously and only where relevant.
  // ---------------------------------------------------------------------
  const buyControls = clickable.filter((el) => BUY_RE.test(text(el)) && !inChrome(el));
  const disabledBuy = allInteractive.some((el) =>
    BUY_RE.test(text(el)) && (el.disabled || el.getAttribute('aria-disabled') === 'true'));

  // Variant gating: a size/colour/date picker means the buy control appears
  // (or enables) after a choice. That is intended design, not friction.
  const variantGated = (() => {
    if (/select (a )?(size|colour|color|option|date|cabin)|choose (a )?(size|colour|color)|please select/i.test(main.innerText || '')) return true;
    if (document.querySelector('[role="radiogroup"],fieldset[data-product-option],[data-option-name],[data-variant-id],[name*="size" i],[id*="size" i],[class*="size-swatch" i],[class*="swatch" i],[class*="variant" i]')) return true;
    return [...document.querySelectorAll('select')].some((s) => /size|colour|color|option|variant|guest|room|cabin/i.test((s.name || '') + (s.id || '') + (s.getAttribute('aria-label') || '')));
  })();

  const hasBuyPath = buyControls.length > 0 || disabledBuy || variantGated;

  if (expectsBuy && buyControls.length > 0) {
    const cta = buyControls[0];
    const r = cta.getBoundingClientRect();
    // Only a real problem when it is far below the fold, not merely a few px.
    if (r.top + window.scrollY > window.innerHeight * 1.5) {
      push(cta, 'medium', 'clarity', 'Primary action sits well below the fold',
        'The main way to proceed is more than a screen and a half down the page on a ' + window.innerWidth + '×' + window.innerHeight + ' viewport.',
        Math.round(r.top + window.scrollY) + 'px from the top of the document.');
    }
  } else if (expectsBuy && !hasBuyPath) {
    push(contentAnchor(), 'high', 'clarity', 'No way to proceed from this step',
      'This step shows a single item but exposes no buy, reserve, continue, or variant-selection affordance at all.',
      'Scanned ' + clickable.length + ' interactive elements and found no buy control, disabled buy control, or option picker.');
  } else if (STAGE === 'listing' || STAGE === 'category') {
    const productLinks = clickable.filter((el) => /\\/(products?|p|item|dp|shop|cruise|sailing|itinerar)\\//i.test(el.getAttribute('href') || ''));
    if (productLinks.length === 0) {
      push(contentAnchor(), 'medium', 'clarity', 'No obvious product links on this listing',
        'Nothing on this listing resolves to a recognisable detail URL, so shoppers (and crawlers) have no clear next step.',
        'Scanned ' + clickable.length + ' interactive elements.');
    }
  }

  // ---------------------------------------------------------------------
  // 2. Click / tap target size — one grouped finding, never a per-link list.
  // ---------------------------------------------------------------------
  const tiny = clickable.filter((el) => {
    if (inChrome(el)) return false;               // breadcrumbs / utility nav
    const label = (el.textContent || '').trim();
    if (!label) return false;                     // icon buttons handled elsewhere
    const r = el.getBoundingClientRect();
    if (r.height === 0) return false;
    // Inline links inside a paragraph are a normal, expected pattern.
    const inProse = !!el.closest('p,li,figcaption,small');
    if (TOUCH) return r.height < 32 && r.width < 120 && !inProse;
    // Desktop: only genuinely hard-to-hit controls (a normal link is ~19px).
    return r.height < 14 && r.width < 60;
  });
  if (tiny.length > 0) {
    const first = tiny[0];
    const r = first.getBoundingClientRect();
    const labels = tiny.slice(0, 4).map((el) => (el.textContent || '').trim().slice(0, 24)).join(', ');
    if (TOUCH) {
      push(first, 'medium', 'accessibility',
        tiny.length === 1 ? 'Tap target under the 44px minimum' : tiny.length + ' tap targets under the 44px minimum',
        'Touch controls below 44×44 are hard to hit accurately and fail WCAG 2.5.8. Smallest measured: ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px.',
        labels);
    } else {
      push(first, 'low', 'accessibility',
        tiny.length === 1 ? 'One very small click target' : tiny.length + ' very small click targets',
        'These controls are under 14px tall on a desktop pointer, which is below comfortable hit size even for a mouse.',
        labels);
    }
  }

  // ---------------------------------------------------------------------
  // 3. Unlabelled form fields — grouped, and only where input is collected.
  // ---------------------------------------------------------------------
  const unlabelled = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea')]
    .filter(visible)
    .filter((el) => !inChrome(el))
    .filter((el) => {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder') || el.getAttribute('title')) return false;
      if (el.closest('label')) return false;
      return !(el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]'));
    });
  if (unlabelled.length > 0) {
    push(unlabelled[0], 'medium', 'form',
      unlabelled.length === 1 ? 'Form field without an accessible label' : unlabelled.length + ' form fields without accessible labels',
      'These fields expose no label, aria-label, or placeholder, so assistive tech announces them as unlabelled and sighted users lose the label once they start typing.',
      unlabelled.slice(0, 4).map(selectorFor).join(', '));
  }

  // ---------------------------------------------------------------------
  // 4. Trust signals at the decision point (buy steps and cart only).
  // ---------------------------------------------------------------------
  const bodyText = document.body.innerText || '';
  if ((expectsBuy || STAGE === 'cart' || STAGE === 'checkout') && hasBuyPath &&
      !/free (shipping|returns|delivery)|money.back|secure checkout|\\d+.day|guarantee|返品|returns policy|price match/i.test(bodyText)) {
    push(buyControls[0] || contentAnchor(), 'medium', 'trust', 'No trust or returns signal near the decision point',
      'Nothing on the page states shipping cost, returns window, guarantee, or payment security where the commitment is made.',
      'Searched page text for shipping, returns, guarantee, and secure-checkout language.');
  }

  // ---------------------------------------------------------------------
  // 5. Images without alt text — content images only, already grouped.
  // ---------------------------------------------------------------------
  const imgs = [...main.querySelectorAll('img')].filter(visible).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width >= 64 && r.height >= 64;       // ignore icons and spacers
  });
  const noAlt = imgs.filter((el) => el.getAttribute('alt') === null);
  if (noAlt.length > 0) {
    push(noAlt[0], 'low', 'accessibility', noAlt.length + ' content image' + (noAlt.length > 1 ? 's' : '') + ' missing alt text',
      'Product imagery without an alt attribute is invisible to screen readers and to image search.',
      noAlt.length + ' of ' + imgs.length + ' large in-content images have no alt attribute.');
  }

  return out;
})()`;

/**
 * A compact, token-cheap description of the page for the LLM reviewer:
 * what the shopper can read and click, plus the geometry needed to pin any
 * finding the model returns back onto the screenshot.
 */
export const PAGE_DIGEST_SCRIPT = `(() => {
  const vw = window.innerWidth;
  const vh = Math.max(document.documentElement.scrollHeight, window.innerHeight);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const main = document.querySelector('main,[role="main"],#main,#MainContent') || document.body;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(((r.left + r.width / 2) / vw) * 1000) / 10,
      y: Math.round((((r.top + window.scrollY) + r.height / 2) / vh) * 1000) / 10,
      w: Math.round(r.width),
      h: Math.round(r.height),
      above_fold: r.top + window.scrollY < window.innerHeight,
    };
  };
  const geometry = {};
  const sel = (el) => {
    const cls = (el.className && typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '');
    return el.id ? '#' + el.id : el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const ref = (el, i) => {
    el.setAttribute('data-fx-ref', String(i));
    const key = 'e' + i;
    const r = el.getBoundingClientRect();
    // Frozen at capture time, in percentages of the full-page screenshot, so a
    // review that finishes after the agent has navigated away still pins onto
    // the right pixels.
    geometry[key] = {
      x_percentage: Math.min(100, Math.max(0, ((r.left + r.width / 2) / vw) * 100)),
      y_percentage: Math.min(100, Math.max(0, ((r.top + window.scrollY + r.height / 2) / vh) * 100)),
      w_percentage: Math.min(100, Math.max(0, (r.width / vw) * 100)),
      h_percentage: Math.min(100, Math.max(0, (r.height / vh) * 100)),
      selector: sel(el),
      text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 70),
    };
    return key;
  };
  let i = 0;
  const controls = [...main.querySelectorAll('a,button,[role="button"],input,select,textarea,summary')]
    .filter(visible)
    .slice(0, 40)
    .map((el) => ({
      ref: ref(el, ++i),
      tag: el.tagName.toLowerCase(),
      text: ((el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 70)),
      disabled: !!(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      ...box(el),
    }));
  const headings = [...main.querySelectorAll('h1,h2,h3')].filter(visible).slice(0, 12).map((el) => ({
    ref: ref(el, ++i),
    level: el.tagName.toLowerCase(),
    text: (el.innerText || '').trim().slice(0, 100),
    ...box(el),
  }));
  const copy = [...main.querySelectorAll('p,li,dd,dt,[role="note"],[role="status"],small')]
    .filter((el) => {
      if (!visible(el)) return false;
      const value = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (value.length < 8 || value.length > 280) return false;
      return ![...el.children].some((child) => visible(child) && (child.innerText || '').trim().length > 7);
    })
    .slice(0, 36)
    .map((el) => ({
      ref: ref(el, ++i),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 280),
      ...box(el),
    }));
  const bodyText = ((document.body && document.body.innerText) || '').replace(/\\s+/g, ' ').trim();
  return {
    url: location.href,
    title: document.title,
    viewport: { width: vw, height: window.innerHeight, document_height: vh },
    above_fold_text: (main.innerText || '').trim().slice(0, 1200),
    page_text: bodyText.slice(0, 6000),
    headings,
    controls,
    copy,
    geometry,
  };
})()`;

/**
 * Kept for callers that still resolve against the live page. The reviewer no
 * longer uses it: geometry is frozen into the digest at capture time.
 */
export const RESOLVE_REF_SCRIPT = (ref) => `(() => {
  const el = document.querySelector('[data-fx-ref="${String(ref).replace(/[^0-9]/g, "")}"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = Math.max(document.documentElement.scrollHeight, window.innerHeight);
  const cls = (el.className && typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '');
  return {
    x_percentage: Math.min(100, Math.max(0, ((r.left + r.width / 2) / vw) * 100)),
    y_percentage: Math.min(100, Math.max(0, ((r.top + window.scrollY + r.height / 2) / vh) * 100)),
    selector: el.id ? '#' + el.id : el.tagName.toLowerCase() + (cls ? '.' + cls : ''),
  };
})()`;

