/**
 * Checkout pass.
 *
 * Many storefronts let a shopper reach the checkout page as a guest — no
 * account, no password. That page is where the most expensive conversion
 * defects live: surprise line items, pre-ticked paid add-ons, fees that only
 * appear at the last step. So when the cart is reached the agent takes one
 * more hop, captures the checkout, and stops the moment a sign-in is demanded.
 *
 * Nothing here submits anything. No payment details are ever entered; the run
 * observes the page and leaves.
 */

/** Does this page look like an actual checkout (not the cart)? */
export const CHECKOUT_PAGE_CHECK = `(() => {
  const text = ((document.body && document.body.innerText) || '').toLowerCase();
  const path = location.pathname.toLowerCase();
  const urlish = /checkout|\\/checkouts?\\/|payment|place-order/.test(path + location.hostname);
  const contact = /contact (information|details)|email address|shipping address|delivery address|billing address|payment method|card number|shipping method|delivery options/.test(text);
  const summary = /order summary|subtotal|order total|total due|estimated total/.test(text);
  const fields = document.querySelectorAll('input[type="email"],input[name*="email" i],input[name*="address" i],input[autocomplete*="shipping" i],input[autocomplete*="postal" i]').length;
  return (urlish && (contact || summary)) || (contact && summary && fields > 0);
})()`;

/**
 * A sign-in demand. Two shapes: a hard wall (the checkout renders a login form
 * and nothing else) and a soft prompt (login offered, guest checkout also
 * available). Only the hard wall ends the run.
 */
export const LOGIN_WALL_CHECK = `(() => {
  const text = ((document.body && document.body.innerText) || '').replace(/\\s+/g, ' ').trim();
  const low = text.toLowerCase();
  const pw = [...document.querySelectorAll('input[type="password"]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const guest = /continue as (a )?guest|guest checkout|checkout as (a )?guest|check out as guest|continue without (an )?account|no account needed/.test(low);
  const demanded = /sign in to (continue|check ?out|complete)|log ?in to (continue|check ?out|complete)|you must (sign|log) in|please (sign|log) in to|create an account to (check ?out|continue)|an account is required/.test(low);
  if (!pw.length && !demanded) return null;
  const phrase = (low.match(/[^.]*(sign in|log in|create an account)[^.]*/) || [''])[0].trim().slice(0, 120);
  return {
    hard: (demanded || pw.length > 0) && !guest,
    guest_available: guest,
    phrase,
  };
})()`;

/** Text on the control that leaves the cart for the checkout. */
export const CHECKOUT_CONTROL_RE =
  /(proceed to |secure |continue to |go to )?check ?out|continue to (payment|shipping|delivery)|place your order|pay now/i;

/**
 * Checkout-specific friction the LLM should not have to notice: money that
 * appeared without the shopper asking for it.
 *
 * The canonical example is a "free returns" line that costs $2.98, or a
 * shipping-protection add-on that arrives pre-ticked. Both are measurable:
 * a priced row whose label promises something free, or a checked input next to
 * a price the shopper never chose.
 */
export const CHECKOUT_FRICTION_SCRIPT = `(() => {
  const vw = window.innerWidth;
  const vh = Math.max(document.documentElement.scrollHeight, window.innerHeight);
  const out = [];
  let id = 1;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const sel = (el) => {
    if (el.id) return '#' + el.id;
    const cls = (el.className && typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const push = (el, severity, category, title, description, evidence) => {
    const r = el.getBoundingClientRect();
    out.push({
      id: id++,
      x_percentage: Math.min(100, Math.max(0, ((r.left + r.width / 2) / vw) * 100)),
      y_percentage: Math.min(100, Math.max(0, ((r.top + window.scrollY + r.height / 2) / vh) * 100)),
      severity,
      category,
      title,
      description,
      evidence,
      selector: sel(el),
    });
  };

  const PRICE = /(?:[$£€]\\s?\\d[\\d,]*(?:\\.\\d{2})?)|(?:\\d[\\d,]*(?:\\.\\d{2})?\\s?(?:USD|EUR|GBP))/;
  const money = (s) => {
    const m = String(s || '').match(PRICE);
    if (!m) return null;
    const n = Number(m[0].replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? { label: m[0], value: n } : null;
  };
  const rowText = (el) => (el.innerText || '').replace(/\\s+/g, ' ').trim();

  // ---- 1. "Free" things that cost money -------------------------------
  const FREE_CLAIM = /free (returns?|shipping|delivery|exchanges?)|complimentary/i;
  const rows = [...document.querySelectorAll('li,tr,[class*="line-item" i],[class*="order-summary" i] div,[data-testid*="line" i]')]
    .filter(visible)
    .filter((el) => rowText(el).length < 220);
  const seen = new Set();
  rows.forEach((el) => {
    const t = rowText(el);
    if (!t || seen.has(t)) return;
    if (!FREE_CLAIM.test(t)) return;
    const price = money(t);
    if (!price || price.value <= 0) return;
    seen.add(t);
    push(el, 'critical', 'trust',
      'A line item described as free is being charged',
      'The order summary contains a line that promises something free while charging for it. This is the single fastest way to lose a shopper at the last step: they re-read the total, stop trusting the number, and abandon. Either rename the line to what it actually is, or make it genuinely free.',
      t.slice(0, 160));
  });

  // ---- 2. Pre-ticked paid add-ons -------------------------------------
  const ADDON = /protection|insurance|warranty|guarantee|carbon|offset|donation|route|shipping upgrade|priority|expedited|returns?/i;
  [...document.querySelectorAll('input[type="checkbox"],input[type="radio"],[role="switch"]')]
    .filter(visible)
    .forEach((el) => {
      const on = el.checked || el.getAttribute('aria-checked') === 'true';
      if (!on) return;
      const scope = el.closest('label,li,tr,div') || el;
      const t = rowText(scope).slice(0, 200);
      if (!ADDON.test(t)) return;
      const price = money(t);
      if (!price || price.value <= 0) return;
      push(el, 'critical', 'trust',
        'A paid extra is pre-selected for the shopper',
        'An optional paid add-on is switched on by default, so the shopper pays for something they never chose. Opt-out pricing reliably produces refund requests, chargebacks and one-star reviews. Default it off and let the value of the add-on sell it.',
        t);
    });

  // ---- 3. Fees that only appear at checkout ---------------------------
  const FEE = /(service|handling|processing|convenience|booking|fulfil?lment|order) fee|surcharge/i;
  rows.forEach((el) => {
    const t = rowText(el);
    if (!t || !FEE.test(t)) return;
    const price = money(t);
    if (!price || price.value <= 0) return;
    const key = 'fee:' + t;
    if (seen.has(key)) return;
    seen.add(key);
    push(el, 'high', 'clarity',
      'A fee appears for the first time at checkout',
      'A charge the shopper could not have seen earlier is added to the total here. Unexpected extras at the final step are the most cited reason for cart abandonment. Show it on the product and cart pages, or fold it into the price.',
      t.slice(0, 160));
  });

  // ---- 4. Guest checkout availability ---------------------------------
  const low = ((document.body && document.body.innerText) || '').toLowerCase();
  const guest = /continue as (a )?guest|guest checkout|checkout as (a )?guest|continue without (an )?account/.test(low);
  const pw = [...document.querySelectorAll('input[type="password"]')].filter(visible);
  if (pw.length && !guest) {
    push(pw[0], 'critical', 'friction',
      'Checkout requires an account',
      'The shopper is asked to sign in or register before they can pay. Forcing account creation is one of the largest measurable drops in checkout completion. Offer guest checkout and invite account creation on the confirmation page instead.',
      'A password field is required with no guest option offered.');
  }

  return out;
})()`;

/**
 * Move from the cart to the checkout page.
 *
 * Tries the on-page control first (it carries the cart session), then the
 * conventional /checkout URL. Returns what it found without capturing —
 * capture is the caller's job so the stage looks like every other stage.
 */
export async function pushToCheckout(page, { emit } = {}) {
  const startUrl = page.url();

  const clickCheckout = async () => {
    const targets = [
      page.getByRole("button", { name: CHECKOUT_CONTROL_RE }),
      page.getByRole("link", { name: CHECKOUT_CONTROL_RE }),
      page.locator('[name="checkout"], button[type="submit"][value*="heckout"]'),
    ];
    for (const locator of targets) {
      const count = await locator.count().catch(() => 0);
      for (let i = 0; i < Math.min(count, 3); i += 1) {
        const item = locator.nth(i);
        if (!(await item.isVisible().catch(() => false))) continue;
        await item.click({ timeout: 8000 }).catch(() => {});
        await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);
        if (page.url() !== startUrl) return true;
        if (await page.evaluate(CHECKOUT_PAGE_CHECK).catch(() => false)) return true;
      }
    }
    return false;
  };

  emit?.("browser", "Cart reached — trying to continue to checkout as a guest");
  let moved = await clickCheckout();

  if (!moved || !(await page.evaluate(CHECKOUT_PAGE_CHECK).catch(() => false))) {
    for (const path of ["/checkout", "/checkouts/cn", "/cart/checkout"]) {
      try {
        const url = new URL(path, startUrl).toString();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(2500);
        if (await page.evaluate(CHECKOUT_PAGE_CHECK).catch(() => false)) {
          moved = true;
          break;
        }
      } catch {
        /* try the next convention */
      }
    }
  }

  const onCheckout = await page.evaluate(CHECKOUT_PAGE_CHECK).catch(() => false);
  const login = await page.evaluate(LOGIN_WALL_CHECK).catch(() => null);

  return { reached: !!onCheckout, moved: !!moved, login: login || null, url: page.url() };
}

/** Measured checkout defects, merged into the checkout stage. */
export async function checkoutFindings(page) {
  try {
    return (await page.evaluate(CHECKOUT_FRICTION_SCRIPT)) || [];
  } catch {
    return [];
  }
}
