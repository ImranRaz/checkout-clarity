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
  return {
    largest_contentful_paint_ms: Math.round(cf.lcp),
    cumulative_layout_shift: Number((cf.cls || 0).toFixed(3)),
    total_blocking_time_ms: Math.round(cf.tbt),
    dom_content_loaded_ms: Math.round(nav ? nav.domContentLoadedEventEnd : 0),
    transfer_bytes: res.reduce((n, r) => n + (r.transferSize || 0), 0) + (nav ? nav.transferSize || 0 : 0),
    request_count: res.length + 1,
    console_errors: [],
    slow_resources: res
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 4)
      .filter((r) => r.duration > 300)
      .map((r) => ({ label: r.name.split('/').pop().slice(0, 48) || r.name, duration_ms: Math.round(r.duration) })),
  };
})()`;
