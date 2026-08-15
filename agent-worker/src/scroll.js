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
  //
  // The bar here is deliberately high. A lazily-loaded image that decodes a
  // beat late is normal engineering, not a defect, and reporting it produces
  // the worst kind of finding: one the screenshot visibly contradicts. So an
  // image only counts as stalled when it is on-screen area, has no painted
  // pixels of its own, and has no background image standing in for it.
  const media = [...document.querySelectorAll('img,iframe')].filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.height < 80) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05;
  });
  const painted = (el) => {
    // Something behind the element is showing the picture instead.
    let node = el;
    for (let i = 0; i < 3 && node; i += 1) {
      const bg = getComputedStyle(node).backgroundImage;
      if (bg && bg !== 'none' && /url\\(/.test(bg)) return true;
      node = node.parentElement;
    }
    return false;
  };
  const stalled = media.filter((el) => {
    if (el.tagName === 'IFRAME') return !el.src && !el.getAttribute('data-src');
    const source = el.currentSrc || el.src || '';
    // A 1px or inline placeholder with a real srcset still resolves later.
    if (!source && !el.srcset && !el.getAttribute('data-src')) return !painted(el);
    if (!el.complete) return false;            // still decoding — not a defect
    if (el.naturalWidth > 1) return false;     // it painted
    return !painted(el);
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
    stalled_media: stalled.slice(0, 6).map((el) => {
      // Tagged so the same elements can be re-checked once the page settles.
      el.setAttribute('data-fx-stalled', '1');
      return {
        selector: selectorFor(el),
        alt: (el.getAttribute('alt') || '').slice(0, 60),
        ...pct(el),
      };
    }),

    stalled_media_count: stalled.length,
    media_count: media.length,
    sticky,
    primary_cta,
    page_text: bodyText.slice(0, 9000),
  };
})()`;

/**
 * Re-examines the elements the sweep flagged as blank, after the page has had
 * a moment to settle. Anything that painted in the meantime was lazy loading,
 * not a broken image, and is dropped from the report.
 */
export const RECHECK_STALLED = `(() => {
  const nodes = [...document.querySelectorAll('[data-fx-stalled]')];
  const selectorFor = (el) => {
    if (el.id) return '#' + el.id;
    const cls = (el.className && typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const painted = (el) => {
    let node = el;
    for (let i = 0; i < 3 && node; i += 1) {
      const bg = getComputedStyle(node).backgroundImage;
      if (bg && bg !== 'none' && /url\\(/.test(bg)) return true;
      node = node.parentElement;
    }
    return false;
  };
  const blank = nodes.filter((el) => {
    if (el.tagName === 'IFRAME') return !el.src && !el.getAttribute('data-src');
    if (!el.complete) return false;
    if (el.naturalWidth > 1) return false;
    return !painted(el);
  });
  nodes.forEach((el) => el.removeAttribute('data-fx-stalled'));
  return {
    count: blank.length,
    recovered: nodes.length - blank.length,
    selectors: blank.map(selectorFor),
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
  let viewportHeight = 900;
  try {
    const box = await page.evaluate(`({ h: ${height}, vp: window.innerHeight })`);
    startHeight = box.h;
    viewportHeight = box.vp || 900;
    // A page barely taller than the viewport has nothing to sweep.
    if (box.h < box.vp * 1.5) {
      const short = await page.evaluate(SCROLL_REPORT).catch(() => null);
      return short ? { ...short, steps: 0, infinite_scroll: false, swept: false, frames: [] } : null;
    }
  } catch {
    return null;
  }

  // Frames are spread across the sweep so the report can show the page as the
  // shopper had it on screen at that depth, not a full-page composite.
  const expectedSteps = Math.min(MAX_STEPS, Math.ceil(startHeight / (viewportHeight * 0.9)));
  const stride = Math.max(1, Math.ceil(expectedSteps / MAX_FRAMES));
  const frames = [];

  const grabFrame = async () => {
    if (frames.length >= MAX_FRAMES) return;
    try {
      const [shot, pos] = await Promise.all([
        page.screenshot({ type: "jpeg", quality: FRAME_QUALITY }),
        page.evaluate(`({ y: window.scrollY, h: ${height}, vp: window.innerHeight })`),
      ]);
      frames.push({
        scroll_y: Math.round(pos.y),
        depth_percentage: Math.round(Math.min(100, (pos.y / Math.max(1, pos.h - pos.vp)) * 100)),
        top_percentage: Math.round((pos.y / Math.max(1, pos.h)) * 1000) / 10,
        bottom_percentage: Math.round(((pos.y + pos.vp) / Math.max(1, pos.h)) * 1000) / 10,
        src: `data:image/jpeg;base64,${shot.toString("base64")}`,
      });
    } catch {
      /* a frame is nice to have, never worth failing the sweep for */
    }
  };

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
    if (steps % stride === 0) await grabFrame();
    if (atBottom) break;
  }
  // Always keep the bottom of the page, even if the stride missed it.
  await grabFrame();

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

  // Second look. Lazy loaders routinely finish a beat after the sweep passes,
  // and the screenshot the report shows is taken after that. Re-checking the
  // tagged elements keeps the finding honest: whatever painted in the meantime
  // is dropped, so the report never claims an image is missing while the
  // evidence image plainly shows it.
  if (report.stalled_media_count > 0) {
    await page.waitForTimeout(1200);
    const stillBlank = await page.evaluate(RECHECK_STALLED).catch(() => null);
    if (stillBlank) {
      const kept = new Set(stillBlank.selectors);
      report.stalled_media = (report.stalled_media || []).filter((m) => kept.has(m.selector));
      report.stalled_media_count = stillBlank.count;
      if (stillBlank.recovered > 0) {
        emit?.(
          "browser",
          `${stillBlank.recovered} image${stillBlank.recovered === 1 ? "" : "s"} finished loading late — not reported as broken`,
        );
      }
    }
  }

  const profile = {
    ...report,
    steps,
    swept: true,
    frames,
    infinite_scroll: endHeight > startHeight * 1.4,
  };
  emit?.(
    "browser",
    `Scrolled the full page (${profile.viewports} screens${frames.length ? `, ${frames.length} viewport frame${frames.length === 1 ? "" : "s"} captured` : ""}${profile.stalled_media_count ? `, ${profile.stalled_media_count} image${profile.stalled_media_count === 1 ? "" : "s"} still blank` : ""})`,
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

  /**
   * The viewport frame captured nearest a given page depth, so a finding about
   * something below the fold can show what the shopper actually had on screen
   * there instead of a pin on a full-page composite.
   */
  const frames = Array.isArray(profile.frames) ? profile.frames : [];
  const frameAt = (depthPct, caption) => {
    if (frames.length === 0) return {};
    const target = Math.min(100, Math.max(0, depthPct));
    const best = frames.reduce((a, b) =>
      Math.abs((a.top_percentage + a.bottom_percentage) / 2 - target) <=
      Math.abs((b.top_percentage + b.bottom_percentage) / 2 - target)
        ? a
        : b,
    );
    return {
      evidence_image: best.src,
      evidence_caption:
        caption ||
        `What the shopper sees between ${Math.round(best.top_percentage)}% and ${Math.round(best.bottom_percentage)}% down the page.`,
    };
  };
  const lastFrame = frames.length ? frames[frames.length - 1] : null;

  // Do not turn DOM image state into a client-facing finding. Modern catalogues
  // routinely keep duplicate responsive/lazy image nodes unpainted while a
  // sibling source or CSS background supplies the pixels visible to shoppers.
  // The sweep still records this diagnostic for telemetry, but an image issue
  // belongs in the report only when visual review can point to a visible broken
  // placeholder. A screenshot that shows the product is the source of truth.



  if (profile.shift_after_load >= 0.1) {
    const shiftDepth =
      profile.worst_shift_scroll_y && profile.document_height
        ? Math.min(96, (profile.worst_shift_scroll_y / profile.document_height) * 100)
        : 50;
    out.push({
      x_percentage: 50,
      y_percentage: shiftDepth,
      ...frameAt(shiftDepth, `The part of the page that moved, at ${Math.round(shiftDepth)}% depth.`),
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
      // The proof is the deepest frame: the action is nowhere on that screen.
      const proof = lastFrame
        ? {
            evidence_image: lastFrame.src,
            evidence_caption: `${Math.round(lastFrame.top_percentage)}–${Math.round(lastFrame.bottom_percentage)}% down the page: “${profile.primary_cta.text}” is nowhere on screen and nothing is pinned in its place.`,
          }
        : {};
      const proofDepth = lastFrame
        ? (lastFrame.top_percentage + lastFrame.bottom_percentage) / 2
        : profile.primary_cta.y_percentage;
      out.push({
        // This finding is about the reading position where the action has been
        // lost, not the button's original position near the top. Pin and order
        // it at the evidence viewport so list numbers follow the page visually.
        x_percentage: 50,
        y_percentage: proofDepth,
        ...(lastFrame
          ? {
              rect: {
                x_percentage: 4,
                y_percentage: lastFrame.top_percentage,
                w_percentage: 92,
                h_percentage: Math.max(1, lastFrame.bottom_percentage - lastFrame.top_percentage),
              },
            }
          : at(profile.primary_cta)),
        ...proof,
        severity: "medium",
        category: "clarity",
        title: "The way to buy scrolls out of reach",
        description: `The page is ${profile.viewports} screens long and the primary action stays put at the top, so a shopper who reads the detail below has to scroll back up to act. Pinning a slim bar carrying “${profile.primary_cta.text}” (with price and the chosen variant) to the bottom of the viewport keeps the decision one tap away at every depth.`,
        evidence: `“${profile.primary_cta.text}” sits at ${profile.primary_cta.depth_percentage}% depth with no persistent bar on a ${profile.viewports}-screen page.`,
        recommendation: `Add a sticky buy bar that appears once “${profile.primary_cta.text}” scrolls out of view, showing price, selected variant and the action itself.`,
        selector: profile.primary_cta.selector,
      });
    }
    if (profile.primary_cta.depth_percentage >= 55) {
      out.push({
        ...at(profile.primary_cta),
        ...frameAt(
          profile.primary_cta.depth_percentage,
          `“${profile.primary_cta.text}” finally appears at ${profile.primary_cta.depth_percentage}% down the page.`,
        ),
        severity: "medium",
        category: "clarity",
        title: "The buying decision is buried down the page",
        description:
          "The primary action sits past the halfway mark of a long page, behind marketing content, so the decision point arrives later than the intent to buy.",
        evidence: `“${profile.primary_cta.text}” is at ${profile.primary_cta.depth_percentage}% of a ${profile.viewports}-screen page.`,
        recommendation: "Move price and the primary action into the first screen, and let the marketing modules follow it rather than precede it.",
        selector: profile.primary_cta.selector,
      });
    }
  }

  const hog = profile.sticky.find((el) => el.coverage_percentage >= 18 && el.edge !== "top");
  if (hog) {
    out.push({
      ...at(hog),
      ...frameAt(hog.y_percentage ?? 50),
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
      ...(lastFrame
        ? {
            evidence_image: lastFrame.src,
            evidence_caption: "The bottom of the page during the sweep — the footer keeps being pushed away.",
          }
        : {}),
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
