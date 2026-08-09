/**
 * Real Web Vitals from the live page. Installed before navigation so the
 * observers catch LCP / CLS / long tasks from the first paint.
 */

export const VITALS_INIT = `(() => {
  window.__cf = { lcp: 0, cls: 0, tbt: 0, errors: [] };
  try {
    new PerformanceObserver((l) => {
      const e = l.getEntries();
      window.__cf.lcp = e[e.length - 1].startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cf.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__cf.tbt += Math.max(0, e.duration - 50);
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
})()`;

export const VITALS_READ = `(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  const cf = window.__cf || { lcp: 0, cls: 0, tbt: 0 };
  // NaN/Infinity JSON-serialise to null and would fail report validation.
  const num = (v) => (Number.isFinite(v) ? v : 0);
  return {
    largest_contentful_paint_ms: Math.round(num(cf.lcp)),
    cumulative_layout_shift: Number(num(cf.cls).toFixed(3)),
    total_blocking_time_ms: Math.round(num(cf.tbt)),
    dom_content_loaded_ms: Math.round(nav ? num(nav.domContentLoadedEventEnd) : 0),
    transfer_bytes: Math.round(res.reduce((n, r) => n + num(r.transferSize), 0) + (nav ? num(nav.transferSize) : 0)),
    request_count: res.length + 1,
    console_errors: [],
    slow_resources: res
      .slice()
      .sort((a, b) => num(b.duration) - num(a.duration))
      .slice(0, 4)
      .filter((r) => num(r.duration) > 300)
      .map((r) => ({ label: String(r.name).split('/').pop().slice(0, 48) || String(r.name), duration_ms: Math.round(num(r.duration)) })),
  };
})()`;

