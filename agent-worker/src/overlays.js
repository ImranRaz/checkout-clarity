/**
 * Modern desktop storefronts stack several interstitials on a first visit:
 * a consent banner pinned to the bottom, a newsletter modal after a delay,
 * a region/currency picker, sometimes an app-download or chat bubble. Any one
 * of them swallows the agent's first click, which used to look like a stalled
 * page and ended the run early.
 *
 * The strategy here is cheap-to-expensive:
 *   1. DOM pass  — click well-known consent/close controls, in the main frame
 *                  and in every same-origin iframe (OneTrust, Klaviyo, etc).
 *   2. Escape    — many modals close on keydown alone.
 *   3. Detect    — is a blocking layer still covering the middle of the screen?
 *   4. LLM pass  — only if something is still in the way, ask the model to
 *                  close it. This is the expensive path, so it runs last.
 */

/** Clicks consent / close controls. Returns how many it clicked. */
export const OVERLAY_SCRIPT = `(() => {
  const ACCEPT = /^(accept|accept all|accept all cookies|allow all|allow cookies|agree|i agree|got it|ok|okay|understood|continue|continue to site|yes, i(’|')?m over|confirm)$/i;
  const DISMISS = /^(close|close dialog|close modal|dismiss|no thanks|no, thanks|not now|maybe later|skip|decline|reject all|deny|cancel|x|✕|×)$/i;
  const KEEP = /(add to (cart|bag|basket)|buy|checkout|proceed|sign in|log in|search)/i;

  const clickable = (el) => {
    if (!el) return false;
    const box = el.getBoundingClientRect();
    if (box.width < 6 || box.height < 6) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05;
  };

  const scan = (root) => {
    let hits = 0;
    const nodes = root.querySelectorAll(
      'button,[role="button"],a[href="#"],[aria-label],[class*="close" i],[id*="close" i],[data-testid*="close" i]'
    );
    for (const el of nodes) {
      const text = (el.innerText || el.textContent || '').trim();
      const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      const candidate = text.length && text.length <= 32 ? text : label;
      if (!candidate || candidate.length > 32) continue;
      if (KEEP.test(candidate)) continue;
      if (!ACCEPT.test(candidate) && !DISMISS.test(candidate)) continue;
      if (!clickable(el)) continue;
      try { el.click(); hits += 1; } catch {}
      if (hits >= 6) break;
    }
    return hits;
  };

  let hits = scan(document);

  // Shadow DOM (common for consent SDKs).
  document.querySelectorAll('*').forEach((el) => {
    if (el.shadowRoot && hits < 6) { try { hits += scan(el.shadowRoot); } catch {} }
  });

  // Unlock scroll locks left behind by closed modals.
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    el.style.overflow = '';
    el.style.position = '';
  }
  return hits;
})()`;

/**
 * Is something still covering the page? Samples the element at the centre and
 * a few offsets, and reports the nearest dialog-ish ancestor when it finds one.
 */
export const MODAL_PRESENT = `(() => {
  const w = window.innerWidth, h = window.innerHeight;
  const points = [[w/2, h/2], [w/2, h*0.35], [w/2, h*0.85], [w*0.2, h/2]];
  const isBlocker = (el) => {
    let node = el;
    while (node && node !== document.body) {
      const s = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const fixed = s.position === 'fixed' || s.position === 'sticky';
      const big = box.width * box.height > w * h * 0.06;
      const layered = Number(s.zIndex || 0) > 50;
      const dialog = node.getAttribute('role') === 'dialog' || node.getAttribute('aria-modal') === 'true';
      if (dialog || (fixed && big && layered)) {
        const text = (node.innerText || '').trim().slice(0, 140).replace(/\\s+/g, ' ');
        return text || 'overlay';
      }
      node = node.parentElement;
    }
    return null;
  };
  for (const [x, y] of points) {
    const el = document.elementFromPoint(x, y);
    const hit = el && isBlocker(el);
    if (hit) return hit;
  }
  return null;
})()`;

/**
 * Everything a reviewer would want to say about a pop-up, read before we close
 * it. A consent wall, newsletter modal or region picker is the first
 * experience a shopper has: its copy, its timing and how hard it makes saying
 * no are all fair game for the audit, not just noise to be clicked away.
 */
export const OVERLAY_CAPTURE = `(() => {
  const w = window.innerWidth, h = window.innerHeight;
  const seen = new Set();
  const out = [];
  const points = [[w/2, h/2], [w/2, h*0.3], [w/2, h*0.88], [w*0.18, h/2], [w*0.82, h/2]];

  const blockerFor = (el) => {
    let node = el;
    while (node && node !== document.body) {
      const s = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const fixed = s.position === 'fixed' || s.position === 'sticky';
      const big = box.width * box.height > w * h * 0.04;
      const layered = Number(s.zIndex || 0) > 50;
      const dialog = node.getAttribute('role') === 'dialog' || node.getAttribute('aria-modal') === 'true' || node.tagName === 'DIALOG';
      if (dialog || (fixed && big && layered)) return node;
      node = node.parentElement;
    }
    return null;
  };

  const ACCEPT = /^(accept|accept all|allow|allow all|agree|i agree|subscribe|sign up|get \\d+%|yes|continue|ok|okay|shop|join|unlock|claim)/i;
  const DECLINE = /(no thanks|no, thanks|not now|maybe later|decline|reject|deny|dismiss|close|skip|cancel|continue without)/i;

  for (const [x, y] of points) {
    const hit = document.elementFromPoint(x, y);
    const node = hit && blockerFor(hit);
    if (!node) continue;
    const r = node.getBoundingClientRect();
    const key = Math.round(r.left) + ':' + Math.round(r.top) + ':' + Math.round(r.width) + ':' + Math.round(r.height);
    if (seen.has(key)) continue;
    seen.add(key);

    const controls = [...node.querySelectorAll('button,[role="button"],a[href],input[type=submit]')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 4 && b.height > 4;
    });
    const labelled = controls.map((el) => {
      const b = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        text: ((el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim()).slice(0, 48),
        area: Math.round(b.width * b.height),
        // A "no thanks" set in 11px grey underline next to a filled button is
        // the classic dark pattern; the numbers make that judgeable.
        font_size: parseFloat(s.fontSize) || 0,
        has_background: s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent',
      };
    }).filter((c) => c.text);

    const accept = labelled.find((c) => ACCEPT.test(c.text));
    const decline = labelled.find((c) => DECLINE.test(c.text));
    const closeControl = controls.find((el) =>
      /close|dismiss|✕|×/i.test((el.getAttribute('aria-label') || el.innerText || '').trim()));

    const heading = node.querySelector('h1,h2,h3,[class*="title" i],[class*="heading" i]');
    const inputs = node.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button])');

    out.push({
      rect: { x: Math.max(0, Math.round(r.left)), y: Math.max(0, Math.round(r.top)), width: Math.round(Math.min(r.width, w)), height: Math.round(Math.min(r.height, h)) },
      coverage_percentage: Math.round(((Math.min(r.width, w) * Math.min(r.height, h)) / (w * h)) * 1000) / 10,
      role: node.getAttribute('role') || node.tagName.toLowerCase(),
      heading: heading ? (heading.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 120) : '',
      text: (node.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 600),
      ctas: labelled.slice(0, 8),
      accept_label: accept ? accept.text : '',
      decline_label: decline ? decline.text : '',
      // Weaker decline: no background fill, or noticeably smaller type.
      decline_is_weaker: !!(accept && decline && (!decline.has_background && accept.has_background || decline.font_size + 1 < accept.font_size)),
      has_close_control: !!closeControl,
      close_is_keyboard_reachable: !!(closeControl && closeControl.tabIndex >= 0),
      asks_for_input: inputs.length,
      elapsed_ms: Math.round(performance.now()),
    });
    if (out.length >= 3) break;
  }
  return out;
})()`;

/**
 * Clear whatever is in the way — but audit it on the way past. Safe to call
 * often: the cheap passes are pure DOM, and the model is only consulted when a
 * blocker survives them.
 */
export async function dismissOverlays(page, { emit, deep = false, capture = true } = {}) {
  let cleared = 0;

  // Audit before dismissal: once it is closed the evidence is gone.
  const captured = [];
  if (capture) {
    let found = [];
    try {
      found = (await page.evaluate(OVERLAY_CAPTURE)) || [];
    } catch {}
    for (const overlay of found.slice(0, 2)) {
      const { rect } = overlay;
      if (rect.width < 60 || rect.height < 40) continue;
      let image = null;
      try {
        const shot = await page.screenshot({
          type: "jpeg",
          quality: 72,
          clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
        image = `data:image/jpeg;base64,${shot.toString("base64")}`;
      } catch {
        /* a crop can fail on a page mid-navigation — the text still stands */
      }
      captured.push({ ...overlay, image });
    }
    if (captured.length > 0) {
      emit?.(
        "vision",
        `Reading the pop-up before closing it${captured[0].heading ? ` (“${captured[0].heading.slice(0, 48)}”)` : ""}`,
      );
    }
  }

  try {

    cleared = (await page.evaluate(OVERLAY_SCRIPT)) || 0;
  } catch {}

  // Same-origin iframes (consent SDKs love these).
  try {
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      await frame.evaluate(OVERLAY_SCRIPT).then((n) => { cleared += n || 0; }).catch(() => {});
    }
  } catch {}

  let blocker = null;
  try {
    blocker = await page.evaluate(MODAL_PRESENT);
  } catch {}

  if (blocker) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
    try {
      blocker = await page.evaluate(MODAL_PRESENT);
    } catch {}
  }

  if (blocker && deep) {
    emit?.("browser", `A pop-up is covering the page — closing it (“${blocker.slice(0, 60)}”)`, "warn");
    try {
      await page.act(
        "Close or dismiss the pop-up, modal, cookie banner or newsletter overlay covering the page. " +
          "Prefer the close (X), 'No thanks', 'Accept all' or 'Continue' control. " +
          "Do not click anything that buys, adds to cart or signs in.",
      );
      await page.waitForTimeout(600);
      await page.evaluate(OVERLAY_SCRIPT).catch(() => {});
      cleared += 1;
    } catch {}
    try {
      blocker = await page.evaluate(MODAL_PRESENT);
    } catch {}
  }

  if (cleared > 0 && !blocker) emit?.("browser", "Dismissed a pop-up before continuing");
  return { cleared, blocker, interstitials: captured };
}
