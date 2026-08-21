/**
 * Third-party booking engines and the new-window problem.
 *
 * Cruise lines, hotels, tour operators and ticket sellers routinely host the
 * marketing site themselves and hand the actual booking to a third party
 * (Seaware, Versonix, Travelport, SynXis, Ticketmaster...). The "Book now"
 * control then opens that engine in a NEW TAB — and an agent that only ever
 * looks at the tab it started in sees "nothing changed" and gives up one click
 * before the funnel it was sent to audit.
 *
 * Two defences, in order of preference:
 *
 *   1. Prevent the split. An init script neutralises `target="_blank"` and
 *      `window.open`, so the engine loads in the tab the agent is driving.
 *      This keeps Stagehand's act/extract pointed at the right page and keeps
 *      the vitals init script, which is registered on the context, in force.
 *
 *   2. Follow anything that still escapes. Some sites open the tab from a
 *      handler we cannot intercept. When that happens we take the popup's URL,
 *      close the popup, and navigate the main tab there — same destination,
 *      one page to drive.
 *
 * Crossing onto another domain mid-journey is expected here and is not a
 * finding; what matters is whether the handover is fast, obviously the same
 * brand, and keeps the shopper's search state.
 */

/**
 * Runs before any page script. Keeps every navigation in the current tab.
 * Deliberately conservative: it rewrites the destination, never blocks it.
 */
export const SAME_TAB_INIT = `(() => {
  try {
    // window.open(url) -> same-tab navigation. Returning the current window
    // keeps callers that do \`const w = window.open(...); w.focus()\` alive.
    const nativeOpen = window.open;
    window.open = function (url, name, features) {
      try {
        if (url) {
          window.location.href = String(url);
          return window;
        }
      } catch (e) {
        /* fall through to the native behaviour */
      }
      return nativeOpen ? nativeOpen.call(window, url, name, features) : null;
    };

    // Strip target="_blank" the moment a link is clicked, so the browser has
    // nothing to open a tab with. Capture phase: before the site's own handler.
    document.addEventListener(
      'click',
      (event) => {
        const anchor = event.target && event.target.closest ? event.target.closest('a[target]') : null;
        if (anchor && anchor.target && anchor.target !== '_self') anchor.target = '_self';
        const form = event.target && event.target.closest ? event.target.closest('form[target]') : null;
        if (form && form.target && form.target !== '_self') form.target = '_self';
      },
      true,
    );
  } catch (e) {
    /* never let this break the page under audit */
  }
})()`;

/**
 * Attaches the fallback follower to a browser context.
 *
 * @param {import('playwright').BrowserContext} context
 * @param {() => any} getPage the tab the agent is driving
 * @param {(actor: string, text: string, tone?: string) => void} [emit]
 */
export function followPopups(context, getPage, emit) {
  if (!context || typeof context.on !== "function") return;

  context.on("page", async (popup) => {
    try {
      const main = getPage();
      if (!main || popup === main) return;

      // Give the popup a moment to resolve its real URL — many open on
      // about:blank and then redirect into the booking engine.
      await popup.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
      let url = popup.url();
      if (!url || url === "about:blank") {
        await popup.waitForTimeout(1500);
        url = popup.url();
      }

      await popup.close().catch(() => {});
      if (!url || url === "about:blank") return;
      if (url === main.url()) return;

      let host = url;
      try {
        host = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        /* keep the raw string */
      }
      emit?.("browser", `That opened a new window (${host}) — following it in the same tab`);
      await main.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
      await main.waitForTimeout(1500);
    } catch {
      /* a popup we cannot follow is not worth failing the run over */
    }
  });
}
