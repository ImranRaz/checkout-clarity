import type { ForensicAuditReport } from "./audit-schema";

import blockedShot from "@/assets/audit-blocked.jpg";
import loomShot from "@/assets/audit-loomandlark.jpg";
import summitShot from "@/assets/audit-summitgear.jpg";
import voltiqueShot from "@/assets/audit-voltique.jpg";

/**
 * Fixture reports. These double as the demo corpus: a live run can be blocked
 * or slow, and the product should always have something real to show.
 */

const summitGear: ForensicAuditReport = {
  id: "wayfarer-outdoor",
  url: "https://wayfarer-outdoor.com/p/atmos-ag-65-backpack",
  domain: "wayfarer-outdoor.com",
  status: "complete",
  blocked_reason: null,
  captured_at: "2026-08-08T09:14:22.000Z",
  run_duration_ms: 41280,
  reached_step: "Cart",
  screenshot: {
    src: summitShot,
    width: 1024,
    height: 1536,
    caption: "Cart page after Add to Cart, full-page capture at 1280 x 1920",
  },
  steps: [
    { actor: "system", text: "Initializing forensic run 8f2c · budget 60s", delay_ms: 0, tone: "normal" },
    { actor: "browser", text: "Session acquired · chromium 128 · viewport 1280x1920", delay_ms: 700, tone: "normal" },
    { actor: "browser", text: "GET /p/atmos-ag-65-backpack → 200 in 1842ms", delay_ms: 900, tone: "normal" },
    { actor: "browser", text: "Waiting for network idle… settled after 3 pending requests", delay_ms: 800, tone: "normal" },
    { actor: "browser", text: "Accessibility tree extracted · 214 nodes · 9 button candidates", delay_ms: 750, tone: "normal" },
    { actor: "vision", text: "Resolving primary purchase affordance from candidate set…", delay_ms: 900, tone: "normal" },
    { actor: "vision", text: 'Selected [data-testid="add-to-cart"] · confidence 0.94', delay_ms: 850, tone: "success" },
    { actor: "browser", text: "click() dispatched · navigation to /cart in 1104ms", delay_ms: 900, tone: "normal" },
    { actor: "browser", text: "Console: 2 errors captured during cart render", delay_ms: 650, tone: "warn" },
    { actor: "browser", text: "Performance entries collected · LCP 2418ms · CLS 0.061", delay_ms: 700, tone: "normal" },
    { actor: "browser", text: "Full-page screenshot written · 1.4 MB", delay_ms: 800, tone: "normal" },
    { actor: "vision", text: "Running CRO + WCAG pass over cart capture…", delay_ms: 1100, tone: "normal" },
    { actor: "vision", text: "4 friction points localised to DOM bounding boxes", delay_ms: 950, tone: "success" },
    { actor: "system", text: "Report sealed · run complete", delay_ms: 600, tone: "success" },
  ],
  technical_metrics: {
    largest_contentful_paint_ms: 2418,
    cumulative_layout_shift: 0.061,
    total_blocking_time_ms: 310,
    dom_content_loaded_ms: 1104,
    transfer_bytes: 3_284_992,
    request_count: 87,
    console_errors: [
      'Refused to load script "https://cdn.trkpx.io/tag.js" — blocked by client',
      "Uncaught (in promise) TypeError: Cannot read properties of null (reading 'dataset')",
    ],
    slow_resources: [
      { label: "hero-tent-4k.jpg (1.1 MB)", duration_ms: 1420 },
      { label: "reviews-widget.bundle.js", duration_ms: 890 },
      { label: "afterpay-messaging.js", duration_ms: 640 },
    ],
  },
  ux_friction_points: [
    {
      id: 1,
      x_percentage: 83,
      y_percentage: 32.5,
      severity: "medium",
      category: "clarity",
      title: "Tax is estimated but never explained",
      description:
        "The summary shows Estimated Tax $23.20 with no jurisdiction or recalculation note. Estimate language this close to the total is a known abandonment trigger for first-time buyers.",
      evidence: "Order summary row 3 · no tooltip, no link",
      selector: ".order-summary__tax",
    },
    {
      id: 2,
      x_percentage: 83,
      y_percentage: 38.4,
      severity: "low",
      category: "trust",
      title: "Two competing primary actions",
      description:
        "Proceed to Checkout and Check out with PayPal are stacked with equal visual weight, splitting attention at the single highest-intent moment on the page.",
      evidence: "Both buttons full-width, adjacent, separated only by an OR rule",
      selector: ".order-summary__actions",
    },
    {
      id: 3,
      x_percentage: 50,
      y_percentage: 66,
      severity: "medium",
      category: "clarity",
      title: "Trust badge row pushes checkout out of view",
      description:
        "Four review badges and a guarantee strip occupy 380 px directly under the fold, so a returning buyer scrolling to confirm shipping loses sight of the checkout button entirely.",
      evidence: "Badge strip height 380 px · checkout CTA scrolled out at 900 px",
      selector: ".trust-strip",
    },
    {
      id: 4,
      x_percentage: 49,
      y_percentage: 80.5,
      severity: "high",
      category: "form",
      title: "Newsletter modal intercepts the cart",
      description:
        "A 10% off email capture opens over the cart on a 6-second timer and traps focus. On mobile widths it covers the order summary completely, and dismissal requires hitting a 24 px close target.",
      evidence: "Modal fires at 6.0 s · focus trap active · close target 24x24 px",
      selector: "#newsletter-modal",
    },
  ],
};

const atelierNoir: ForensicAuditReport = {
  id: "atelier-noir",
  url: "https://atelier-noir.com/products/chunky-cashmere-crewneck",
  domain: "atelier-noir.com",
  status: "complete",
  blocked_reason: null,
  captured_at: "2026-08-07T16:48:03.000Z",
  run_duration_ms: 33940,
  reached_step: "Cart",
  screenshot: {
    src: loomShot,
    width: 1024,
    height: 1536,
    caption: "Cart page after Add to Bag, full-page capture at 1280 x 1920",
  },
  steps: [
    { actor: "system", text: "Initializing forensic run 4a91 · budget 60s", delay_ms: 0, tone: "normal" },
    { actor: "browser", text: "Session acquired · chromium 128 · viewport 1280x1920", delay_ms: 700, tone: "normal" },
    { actor: "browser", text: "GET /products/chunky-cashmere-crewneck → 200 in 812ms", delay_ms: 850, tone: "normal" },
    { actor: "browser", text: "Network idle after 640ms · 31 requests", delay_ms: 700, tone: "success" },
    { actor: "browser", text: "Accessibility tree extracted · 96 nodes · 3 button candidates", delay_ms: 700, tone: "normal" },
    { actor: "vision", text: 'Selected button[name="add"] · confidence 0.97', delay_ms: 900, tone: "success" },
    { actor: "browser", text: "click() dispatched · navigation to /cart in 486ms", delay_ms: 850, tone: "normal" },
    { actor: "browser", text: "Console: clean · 0 errors", delay_ms: 600, tone: "success" },
    { actor: "browser", text: "Performance entries collected · LCP 1284ms · CLS 0.011", delay_ms: 700, tone: "normal" },
    { actor: "vision", text: "Running CRO + WCAG pass over cart capture…", delay_ms: 1000, tone: "normal" },
    { actor: "vision", text: "3 friction points localised · 1 contrast failure", delay_ms: 900, tone: "warn" },
    { actor: "system", text: "Report sealed · run complete", delay_ms: 600, tone: "success" },
  ],
  technical_metrics: {
    largest_contentful_paint_ms: 1284,
    cumulative_layout_shift: 0.011,
    total_blocking_time_ms: 60,
    dom_content_loaded_ms: 486,
    transfer_bytes: 742_400,
    request_count: 31,
    console_errors: [],
    slow_resources: [{ label: "cashmere-crew-black.jpg (240 KB)", duration_ms: 310 }],
  },
  ux_friction_points: [
    {
      id: 1,
      x_percentage: 20,
      y_percentage: 56.5,
      severity: "high",
      category: "accessibility",
      title: "Shipping copy fails WCAG AA contrast",
      description:
        "Free shipping over $500 and Shipping to: United States render at #9A9A9A on #FFFFFF — a 2.8:1 ratio against a 4.5:1 requirement. The threshold that would drive a second item into the bag is the least legible text on the page.",
      evidence: "Measured contrast 2.8:1 · required 4.5:1",
      selector: ".shipping-note",
    },
    {
      id: 2,
      x_percentage: 75,
      y_percentage: 54.5,
      severity: "medium",
      category: "trust",
      title: "Checkout button reads as secondary",
      description:
        "The only conversion action is a thin outlined rectangle, visually subordinate to the solid black Subscribe button further down the page. Users scanning for the primary action land on the newsletter first.",
      evidence: "CTA: 1 px border, no fill · Subscribe: solid fill",
      selector: ".cart__checkout",
    },
    {
      id: 3,
      x_percentage: 88,
      y_percentage: 71,
      severity: "low",
      category: "clarity",
      title: "Email capture outranks the order",
      description:
        "The 10% off block sits immediately under the summary with the strongest button on the page, drawing intent away from checkout at the moment of decision.",
      evidence: "Subscribe block 168 px tall, directly below total",
      selector: ".newsletter-band",
    },
  ],
};

const techBazaar: ForensicAuditReport = {
  id: "techbazaar",
  url: "https://techbazaar.example/product/sony-wh-1000xm5",
  domain: "techbazaar.example",
  status: "complete",
  blocked_reason: null,
  captured_at: "2026-08-06T11:02:47.000Z",
  run_duration_ms: 58610,
  reached_step: "Cart",
  screenshot: {
    src: voltiqueShot,
    width: 1024,
    height: 1536,
    caption: "Cart step of the 4-step checkout, full-page capture at 1280 x 1920",
  },
  steps: [
    { actor: "system", text: "Initializing forensic run c07d · budget 60s", delay_ms: 0, tone: "normal" },
    { actor: "browser", text: "Session acquired · chromium 128 · viewport 1280x1920", delay_ms: 700, tone: "normal" },
    { actor: "browser", text: "GET /product/sony-wh-1000xm5 → 200 in 3418ms", delay_ms: 1000, tone: "warn" },
    { actor: "browser", text: "Network idle not reached in 8000ms · proceeding on DOM stable", delay_ms: 1100, tone: "warn" },
    { actor: "browser", text: "Dismissed interstitial: app-download overlay", delay_ms: 800, tone: "normal" },
    { actor: "browser", text: "Accessibility tree extracted · 612 nodes · 27 button candidates", delay_ms: 850, tone: "normal" },
    { actor: "vision", text: "Candidate set ambiguous · 3 add-to-cart labels present", delay_ms: 950, tone: "warn" },
    { actor: "vision", text: "Selected #buy-now-primary · confidence 0.71", delay_ms: 900, tone: "normal" },
    { actor: "browser", text: "click() dispatched · navigation to /checkout/cart in 2960ms", delay_ms: 1000, tone: "normal" },
    { actor: "browser", text: "Console: 5 errors captured during cart render", delay_ms: 700, tone: "error" },
    { actor: "browser", text: "Performance entries collected · LCP 4820ms · CLS 0.284", delay_ms: 750, tone: "error" },
    { actor: "vision", text: "Running CRO + WCAG pass over cart capture…", delay_ms: 1100, tone: "normal" },
    { actor: "vision", text: "5 friction points localised · 3 high severity", delay_ms: 950, tone: "error" },
    { actor: "system", text: "Report sealed · run complete", delay_ms: 600, tone: "success" },
  ],
  technical_metrics: {
    largest_contentful_paint_ms: 4820,
    cumulative_layout_shift: 0.284,
    total_blocking_time_ms: 1240,
    dom_content_loaded_ms: 2960,
    transfer_bytes: 7_918_182,
    request_count: 214,
    console_errors: [
      "Uncaught ReferenceError: dataLayer is not defined",
      'Failed to load resource: 404 "/static/emi-widget.v3.css"',
      "Mixed Content: requested an insecure image 'http://cdn.techbazaar.example/badge.png'",
      "Uncaught (in promise) DOMException: play() failed because the user didn't interact",
      "[Violation] 'setTimeout' handler took 412ms",
    ],
    slow_resources: [
      { label: "livechat-sdk.js (612 KB)", duration_ms: 2180 },
      { label: "exchange-offer-carousel.js", duration_ms: 1640 },
      { label: "recommendations-v4.json", duration_ms: 1210 },
      { label: "payment-logos-sprite.png", duration_ms: 780 },
    ],
  },
  ux_friction_points: [
    {
      id: 1,
      x_percentage: 50,
      y_percentage: 12,
      severity: "medium",
      category: "clarity",
      title: "Three promotional banners precede the cart",
      description:
        "Bank offer, exchange offer, and free delivery banners consume the first 210 px of the checkout step. The user has already decided to buy; the page is still selling.",
      evidence: "Banner stack 210 px above the cart heading",
      selector: ".offer-banners",
    },
    {
      id: 2,
      x_percentage: 50,
      y_percentage: 19.7,
      severity: "high",
      category: "clarity",
      title: "Step indicator numbering is broken",
      description:
        "The progress rail labels both Payment and Place Order as step 3. Users cannot tell how many steps remain, which is the single strongest predictor of checkout abandonment.",
      evidence: "Steps render 1, 2, 3, 3",
      selector: ".checkout-steps",
    },
    {
      id: 3,
      x_percentage: 34,
      y_percentage: 43.5,
      severity: "high",
      category: "form",
      title: "Warranty upsell interrupts the cart",
      description:
        "Three extended-warranty checkboxes sit between the product row and the payment section, adding a decision worth up to ₹2,999 before the user has confirmed the order they came for.",
      evidence: "3 unchecked options · 168 px tall block mid-flow",
      selector: "#warranty-upsell",
    },
    {
      id: 4,
      x_percentage: 41,
      y_percentage: 60,
      severity: "high",
      category: "form",
      title: "Payment selection before order confirmation",
      description:
        "The full payment method matrix — UPI, cards, net banking, EMI, wallets, COD — with a live QR code renders inside the cart step, before the user has reviewed the address. The QR expires on a timer they cannot see.",
      evidence: "Payment block 280 px tall, inside step 1 of 4",
      selector: ".payment-options",
    },
    {
      id: 5,
      x_percentage: 87,
      y_percentage: 75,
      severity: "medium",
      category: "trust",
      title: "Chat widget covers the Continue button",
      description:
        "The live chat panel opens unprompted at 1280 px width and overlaps the right rail, obscuring the Continue button until dismissed.",
      evidence: "Widget 320x420 px, z-index above CTA column",
      selector: "#livechat-root",
    },
  ],
};

const blockedRun: ForensicAuditReport = {
  id: "northsupply-blocked",
  url: "https://northsupply.example/p/merino-base-layer",
  domain: "northsupply.example",
  status: "partial",
  blocked_reason:
    "Bot-protection interlock held the session for the full navigation budget. No product DOM was ever served, so no cart run was possible.",
  captured_at: "2026-08-08T08:31:10.000Z",
  run_duration_ms: 60000,
  reached_step: "Navigation",
  screenshot: {
    src: blockedShot,
    width: 1024,
    height: 1024,
    caption: "Interlock page served in place of the product page",
  },
  steps: [
    { actor: "system", text: "Initializing forensic run 21be · budget 60s", delay_ms: 0, tone: "normal" },
    { actor: "browser", text: "Session acquired · chromium 128 · viewport 1280x1920", delay_ms: 700, tone: "normal" },
    { actor: "browser", text: "GET /p/merino-base-layer → 403 in 640ms", delay_ms: 900, tone: "warn" },
    { actor: "browser", text: "Interlock detected: managed challenge · ray 7f9c2e1d", delay_ms: 850, tone: "warn" },
    { actor: "browser", text: "Retry 1/2 with residential egress → challenge persists", delay_ms: 1100, tone: "warn" },
    { actor: "browser", text: "Retry 2/2 after 6s backoff → challenge persists", delay_ms: 1100, tone: "error" },
    { actor: "system", text: "Navigation budget exhausted at 60000ms", delay_ms: 800, tone: "error" },
    { actor: "vision", text: "No product DOM available · skipping cart traversal", delay_ms: 700, tone: "warn" },
    { actor: "vision", text: "Auditing what was served instead", delay_ms: 900, tone: "normal" },
    { actor: "system", text: "Partial report sealed · 1 of 5 stages completed", delay_ms: 600, tone: "warn" },
  ],
  technical_metrics: {
    largest_contentful_paint_ms: 780,
    cumulative_layout_shift: 0.004,
    total_blocking_time_ms: 20,
    dom_content_loaded_ms: 402,
    transfer_bytes: 48_128,
    request_count: 6,
    console_errors: [],
    slow_resources: [],
  },
  ux_friction_points: [
    {
      id: 1,
      x_percentage: 50,
      y_percentage: 50,
      severity: "high",
      category: "trust",
      title: "Interlock served to a legitimate desktop session",
      description:
        "A standard Chromium session with a normal user agent was challenged and never released. Whatever the intent, real customers on VPNs, corporate networks, and privacy browsers hit exactly this wall and never see a product.",
      evidence: "403 on first request · challenge unresolved after 2 retries",
      selector: "#challenge-form",
    },
  ],
};

export const fixtureReports: ForensicAuditReport[] = [
  summitGear,
  techBazaar,
  atelierNoir,
  blockedRun,
];

export function getReportById(id: string): ForensicAuditReport | undefined {
  return fixtureReports.find((r) => r.id === id);
}
