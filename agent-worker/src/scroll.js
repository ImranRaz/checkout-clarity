/**
 * The scroll pass.
 *
 * Until now every stage was: land, wait, screenshot the full page, read the
 * DOM, move on. A full-page screenshot makes it *look* like the whole page was
 * examined, but nothing below the fold had ever been rendered in a viewport,
 * so lazy media, sticky behaviour and scroll-triggered layout shift were
 * invisible to us. A human auditor scrolls first and forms half their opinion
 * during that scroll.
 *
 * The sweep is deliberately bounded (steps, settle time, hard budget) because
 * every second here is paid for in cloud-browser minutes. It also pays for
 * itself: scrolling forces lazy images to decode, so the screenshot we capture
 * afterwards contains real content instead of grey placeholder boxes.
 */

const MAX_STEPS = Number(process.env.AGENT_SCROLL_STEPS || 12);
const STEP_SETTLE_MS = Number(process.env.AGENT_SCROLL_SETTLE_MS || 250);
const BUDGET_MS = Number(process.env.AGENT_SCROLL_BUDGET_MS || 8000);
/**
 * Viewport frames captured during the sweep. A full-page screenshot proves a
 * page exists; it does not show what the shopper actually has on screen at
 * 60% depth — which is the whole point of findings like "the way to buy
 * scrolls out of reach". These frames are the evidence for those.
 */
const MAX_FRAMES = Number(process.env.AGENT_SCROLL_FRAMES || 4);
const FRAME_QUALITY = Number(process.env.AGENT_SCROLL_FRAME_QUALITY || 45);


/**
 * Installed before the sweep. Layout shift *after* load is the interesting
 * number — the initial-load CLS is already measured by vitals.js — and long
 * tasks during scrolling are what a shopper feels as stutter.
 */
export const SCROLL_INIT = `(() => {
  if (window.__fxScroll) { window.__fxScroll.shift = 0; window.__fxScroll.longTasks = 0; window.__fxScroll.longestTask = 0; return true; }
  const state = { shift: 0, longTasks: 0, longestTask: 0, worstShiftY: null };
  window.__fxScroll = state;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        state.shift += entry.value;
        if (entry.value > 0.01) state.worstShiftY = Math.round(window.scrollY);
      }
    }).observe({ type: 'layout-shift', buffered: false });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks += 1;
        state.longestTask = Math.max(state.longestTask, Math.round(entry.duration));
      }
    }).observe({ type: 'longtask', buffered: false });
  } catch {}
  return true;
})()`;

/**
 * Read once at the end of the sweep, from the top of the page. Everything here
 * is measured, not inferred: what never loaded, what is stuck to the viewport,
 * and how far down the page the buying decision actually lives.
 */
export const SCROLL_REPORT = `(() => {
  const vw = window.innerWidth;
  const vpH = window.innerHeight;
  const docH = Math.max(document.documentElement.scrollHeight, vpH);
  const s = window.__fxScroll || { shift: 0, longTasks: 0, longestTask: 0, worstShiftY: null };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05;
  };
  const pct = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x_percentage: Math.min(100, Math.max(0, ((r.left + r.width / 2) / vw) * 100)),
      y_percentage: Math.min(100, Math.max(0, ((r.top + window.scrollY + r.height / 2) / docH) * 100)),
      w_percentage: Math.min(100, Math.max(0, (r.width / vw) * 100)),
      h_percentage: Math.min(100, Math.max(0, (r.height / docH) * 100)),
    };
  };
  const selectorFor = (el) => {
    if (el.id) return '#' + el.id;
    const cls = (el.className && typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };

  // Media that has been scrolled past and still has nothing to show.
  const media = [...document.querySelectorAll('img,iframe')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width >= 80 && r.height >= 80;
  });
  const stalled = media.filter((el) => {
    if (el.tagName === 'IFRAME') return !el.src;
    if (!el.currentSrc && !el.src) return true;
    return el.complete === false || (el.naturalWidth === 0 && el.getAttribute('loading') !== 'eager');
  });

  // Sticky / fixed furniture: helpful when it carries the primary action,
  // harmful when it merely eats the viewport or covers content.
  const sticky = [...document.querySelectorAll('body *')].filter((el) => {
    const st = getComputedStyle(el);
    if (st.position !== 'fixed' && st.position !== 'sticky') return false;
    if (!visible(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width * r.height > vw * vpH * 0.02;
  }).slice(0, 8).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      selector: selectorFor(el),
      text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 90),
      coverage_percentage: Math.round(((r.width * r.height) / (vw * vpH)) * 1000) / 10,
      edge: r.top < vpH * 0.35 ? 'top' : r.top > vpH * 0.6 ? 'bottom' : 'middle',
      ...pct(el),
    };
  });

  const BUY = /add to (cart|bag|basket)|buy now|buy it now|checkout|reserve|book now|price & build|continue|proceed|select (a )?(size|cabin|date|fare)/i;
  const controls = [...document.querySelectorAll('a,button,[role="button"],input[type=submit]')].filter(visible);
  const cta = controls.find((el) => BUY.test(((el.innerText || el.value || el.getAttribute('aria-label') || '')).trim()));
  let primary_cta = null;
  if (cta) {
    const r = cta.getBoundingClientRect();
    primary_cta = {
      text: (cta.innerText || cta.value || cta.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
      depth_percentage: Math.min(100, Math.max(0, Math.round((((r.top + window.scrollY) / docH) * 100)))),
      selector: selectorFor(cta),
      sticky: !!cta.closest('[style*="position:fixed"]') || ['fixed', 'sticky'].indexOf(getComputedStyle(cta.parentElement || cta).position) !== -1,
      ...pct(cta),
    };
  }

  // The full post-lazy-load copy. Before the sweep this was mostly above-fold
  // text, which is how the reviewer ended up saying "no returns policy" about
  // pages that state it in the footer.
  const bodyText = ((document.body && document.body.innerText) || '').replace(/\\s+/g, ' ').trim();

  return {
    viewports: Math.round((docH / vpH) * 10) / 10,
    document_height: docH,
    viewport_height: vpH,
    shift_after_load: Math.round(s.shift * 1000) / 1000,
    worst_shift_scroll_y: s.worstShiftY,
    long_tasks: s.longTasks,
    longest_task_ms: s.longestTask,
    stalled_media: stalled.slice(0, 6).map((el) => ({
      selector: selectorFor(el),
      alt: (el.getAttribute('alt') || '').slice(0, 60),
      ...pct(el),
    })),
    stalled_media_count: stalled.length,
    media_count: media.length,
    sticky,
    primary_cta,
    page_text: bodyText.slice(0, 9000),
  };
})()`;

const height = `Math.max(document.documentElement.scrollHeight, window.innerHeight)`;

/**
 * Scrolls the page the way a reviewer would, then returns to the top so the
 * screenshot that follows is taken from a settled, fully-decoded page.
 */
export async function scrollSweep(page, { emit } = {}) {
  const deadline = Date.now() + BUDGET_MS;
  try {
    await page.evaluate(SCROLL_INIT);
  } catch {
    return null;
  }

  let startHeight = 0;
  try {
    const box = await page.evaluate(`({ h: ${height}, vp: window.innerHeight })`);
    startHeight = box.h;
    // A page barely taller than the viewport has nothing to sweep.
    if (box.h < box.vp * 1.5) {
      const short = await page.evaluate(SCROLL_REPORT).catch(() => null);
      return short ? { ...short, steps: 0, infinite_scroll: false, swept: false } : null;
    }
  } catch {
    return null;
  }

  let steps = 0;
  for (; steps < MAX_STEPS && Date.now() < deadline; steps += 1) {
    const atBottom = await page
      .evaluate(
        `(() => {
          window.scrollBy(0, window.innerHeight * 0.9);
          return window.scrollY + window.innerHeight >= ${height} - 4;
        })()`,
      )
      .catch(() => true);
    await page.waitForTimeout(STEP_SETTLE_MS);
    if (atBottom) break;
  }

  // Height that keeps growing at the bottom means an infinite feed.
  let endHeight = startHeight;
  try {
    await page.waitForTimeout(400);
    endHeight = await page.evaluate(height);
  } catch {}

  const report = await page.evaluate(SCROLL_REPORT).catch(() => null);

  await page.evaluate(`window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' })`).catch(() => {});
  await page.waitForTimeout(350);

  if (!report) return null;
  const profile = {
    ...report,
    steps,
    swept: true,
    infinite_scroll: endHeight > startHeight * 1.4,
  };
  emit?.(
    "browser",
    `Scrolled the full page (${profile.viewports} screens${profile.stalled_media_count ? `, ${profile.stalled_media_count} image${profile.stalled_media_count === 1 ? "" : "s"} still blank` : ""})`,
  );
  return profile;
}

/**
 * Measured findings derived from the sweep. These belong with the vitals and
 * tap-target checks — the honest floor under the model's judgement — so they
 * are plain data, never opinion.
 */
export function scrollFindings(profile, kind = "other") {
  if (!profile) return [];
  const out = [];
  const at = (geo, fallbackY = 50) => ({
    x_percentage: geo?.x_percentage ?? 50,
    y_percentage: geo?.y_percentage ?? fallbackY,
    ...(geo?.w_percentage
      ? {
          rect: {
            x_percentage: Math.max(0, geo.x_percentage - geo.w_percentage / 2),
            y_percentage: Math.max(0, geo.y_percentage - geo.h_percentage / 2),
            w_percentage: Math.max(1, geo.w_percentage),
            h_percentage: Math.max(0.5, geo.h_percentage),
          },
        }
      : {}),
  });

  if (profile.stalled_media_count >= 3) {
    out.push({
      ...at(profile.stalled_media[0]),
      severity: profile.stalled_media_count >= 8 ? "high" : "medium",
      category: "performance",
      title: `${profile.stalled_media_count} images never loaded while scrolling`,
      description:
        "These images stayed blank even after being scrolled into view, so a shopper reading down the page sees empty boxes where product imagery should be.",
      evidence: `${profile.stalled_media_count} of ${profile.media_count} large images had no rendered source after a full-page scroll.`,
      selector: profile.stalled_media[0]?.selector,
    });
  }

  if (profile.shift_after_load >= 0.1) {
    out.push({
      x_percentage: 50,
      y_percentage: profile.worst_shift_scroll_y && profile.document_height
        ? Math.min(96, (profile.worst_shift_scroll_y / profile.document_height) * 100)
        : 50,
      severity: profile.shift_after_load >= 0.25 ? "high" : "medium",
      category: "performance",
      title: "The page moves under you as you scroll",
      description:
        "Content shifted position after the initial load while scrolling down. This is what makes shoppers tap the wrong control and lose their place mid-decision.",
      evidence: `Cumulative layout shift of ${profile.shift_after_load.toFixed(3)} accumulated during the scroll pass, after load had completed.`,
    });
  }

  if (profile.long_tasks >= 6 || profile.longest_task_ms >= 400) {
    out.push({
      x_percentage: 50,
      y_percentage: 40,
      severity: "medium",
      category: "performance",
      title: "Scrolling stutters on this page",
      description:
        "The main thread was blocked repeatedly while scrolling, so the page cannot repaint smoothly and feels heavy on mid-range hardware.",
      evidence: `${profile.long_tasks} long task${profile.long_tasks === 1 ? "" : "s"} during the scroll pass, longest ${profile.longest_task_ms}ms.`,
    });
  }

  const BUY_STAGES = ["product", "detail", "variant", "options", "summary", "cart", "checkout"];
  if (BUY_STAGES.indexOf(kind) !== -1 && profile.viewports >= 3 && profile.primary_cta) {
    const stickyCta = profile.sticky.some((el) => /add to|buy|book|reserve|checkout|continue|price/i.test(el.text));
    if (!stickyCta && profile.primary_cta.depth_percentage <= 40) {
      out.push({
        ...at(profile.primary_cta),
        severity: "medium",
        category: "clarity",
        title: "The way to buy scrolls out of reach",
        description: `The page is ${profile.viewports} screens long and the primary action stays put at the top, so a shopper who reads the detail below has to scroll back up to act.`,
        evidence: `“${profile.primary_cta.text}” sits at ${profile.primary_cta.depth_percentage}% depth with no persistent bar on a ${profile.viewports}-screen page.`,
        selector: profile.primary_cta.selector,
      });
    }
    if (profile.primary_cta.depth_percentage >= 55) {
      out.push({
        ...at(profile.primary_cta),
        severity: "medium",
        category: "clarity",
        title: "The buying decision is buried down the page",
        description:
          "The primary action sits past the halfway mark of a long page, behind marketing content, so the decision point arrives later than the intent to buy.",
        evidence: `“${profile.primary_cta.text}” is at ${profile.primary_cta.depth_percentage}% of a ${profile.viewports}-screen page.`,
        selector: profile.primary_cta.selector,
      });
    }
  }

  const hog = profile.sticky.find((el) => el.coverage_percentage >= 18 && el.edge !== "top");
  if (hog) {
    out.push({
      ...at(hog),
      severity: "medium",
      category: "clarity",
      title: "A pinned bar eats the screen while scrolling",
      description:
        "This element stays fixed over the page during the whole scroll, covering content a shopper is trying to read on smaller screens.",
      evidence: `Pinned element covering ${hog.coverage_percentage}% of the viewport${hog.text ? `: “${hog.text.slice(0, 50)}”` : ""}.`,
      selector: hog.selector,
    });
  }

  if (profile.infinite_scroll && (kind === "listing" || kind === "category")) {
    out.push({
      x_percentage: 50,
      y_percentage: 92,
      severity: "low",
      category: "clarity",
      title: "Infinite scroll with no reachable footer",
      description:
        "The listing keeps loading as you reach the bottom, so shipping, returns and support links in the footer are effectively unreachable and returning to a product after a back-navigation loses your place.",
      evidence: "Document height kept growing after scrolling to the bottom.",
    });
  }

  return out;
}

/** A short, prompt-ready description of what the scroll revealed. */
export function scrollBrief(profile) {
  if (!profile) return "";
  const bits = [
    `page is ${profile.viewports} viewports tall`,
    profile.primary_cta
      ? `primary action “${profile.primary_cta.text}” at ${profile.primary_cta.depth_percentage}% depth`
      : "no primary action detected",
    `${profile.stalled_media_count}/${profile.media_count} large images still blank after scrolling`,
    `layout shift after load ${profile.shift_after_load}`,
    profile.sticky.length ? `${profile.sticky.length} pinned element(s) while scrolling` : "nothing pinned while scrolling",
    profile.infinite_scroll ? "infinite scroll detected" : null,
  ].filter(Boolean);
  return `Scroll pass: ${bits.join("; ")}.`;
}
