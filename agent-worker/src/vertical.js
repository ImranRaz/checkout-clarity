/**
 * What business is this, actually?
 *
 * The reviewer used to be handed a page with no idea what was being sold, so
 * it asked a cruise line about shipping costs and returns windows. A buyer of
 * a $6,000 sailing has no such concerns; they have deposit, cancellation
 * policy, port fees, occupancy and what's included. Getting this wrong makes
 * the whole audit read as generic.
 *
 * Classification is deterministic and free: it reads the page's own words.
 * No LLM round trip before the first click.
 */

export const VERTICALS = {
  travel: {
    id: "travel",
    name: "Travel / booking (cruise, hotel, flight, tour, rental)",
    temperature:
      "High-consideration, high-ticket, researched across multiple sessions and often two decision-makers. " +
      "Nobody books this impulsively; the job of each page is to remove doubt and keep the search state alive.",
    expects: [
      "the real total for the chosen dates and party, not only a 'from' lead-in price",
      "what is included versus extra (meals, excursions, transfers, taxes, port fees, resort fees)",
      "deposit amount and payment schedule",
      "cancellation, change and refund policy near the commitment",
      "availability and date clarity, and whether the shown price matches the selected date",
      "occupancy assumptions (per person, double occupancy) stated where the price is",
      "a way to reach a human — this category sells over the phone too",
      "search/selection state preserved between steps",
    ],
    never: [
      "shipping cost, delivery date, or a returns window — nothing is shipped",
      "stock levels or size/fit guidance",
      "add-to-cart language; the equivalents are Book, Reserve, Select, Continue",
    ],
  },
  goods: {
    id: "goods",
    name: "Physical goods retail",
    temperature:
      "Mixed impulse and considered. Decisions are fast; every extra unknown at the buy button costs a sale.",
    expects: [
      "delivered price: shipping cost and threshold, plus estimated delivery date",
      "returns window and who pays return postage",
      "size, fit or spec guidance at the decision point",
      "stock and variant availability made obvious before the buy click",
      "clear primary buy action once required options are chosen",
    ],
    never: [
      "booking, deposit or cancellation-policy language",
      "flagging a disabled buy button that is simply waiting on a size or colour",
    ],
  },
  ticketing: {
    id: "ticketing",
    name: "Tickets / events",
    temperature:
      "Urgent and scarcity-driven. Buyers tolerate speed but punish surprise fees.",
    expects: [
      "all-in pricing, or fees disclosed before the last step",
      "seat, section or tier clarity and what differs between them",
      "delivery method and transfer/resale rules",
      "any hold timer explained rather than silently counting down",
    ],
    never: ["shipping cost or returns window for physical parcels", "size/fit guidance"],
  },
  subscription: {
    id: "subscription",
    name: "Subscription / SaaS",
    temperature:
      "Evaluative. The buyer is judging risk of being locked in as much as the product itself.",
    expects: [
      "price per period and what happens after any trial",
      "what is gated at each tier",
      "cancellation path stated plainly",
      "whether a card is required up front",
    ],
    never: ["shipping, delivery, returns, stock, or size guidance"],
  },
  services: {
    id: "services",
    name: "Services / lead generation",
    temperature: "Consultative. The conversion is an enquiry, not a payment.",
    expects: [
      "what happens after the form is sent, and how quickly",
      "price range or how pricing works, even approximately",
      "credibility: clients, results, credentials",
      "form length proportionate to the ask",
    ],
    never: ["cart, shipping, returns, or stock language"],
  },
  food: {
    id: "food",
    name: "Food / grocery / delivery",
    temperature: "Fast, repeat, often mobile and impatient.",
    expects: [
      "delivery area, time window and fees before basket build",
      "minimum order value",
      "substitution and freshness policy",
    ],
    never: ["returns window for parcels", "size/fit guidance"],
  },
  generic: {
    id: "generic",
    name: "Unclassified commerce",
    temperature: "Unknown buying temperature — judge only what is visible on the page.",
    expects: [
      "a complete and honest price at the point of commitment",
      "the information needed to decide, present at the decision point",
      "one unambiguous next action",
    ],
    never: [
      "assuming a shipping, returns or delivery model that the page never mentions",
    ],
  },
};

/**
 * Runs in the browser. Returns counts of category-defining vocabulary rather
 * than a verdict, so the scoring stays here where it is readable.
 */
export const VERTICAL_SCRIPT = `(() => {
  const text = (((document.body && document.body.innerText) || '') + ' ' + document.title).toLowerCase().slice(0, 20000);
  const href = location.href.toLowerCase();
  const n = (re) => (text.match(re) || []).length;
  return {
    href,
    travel: n(/\\b(cruise|sailing|stateroom|cabin|itinerary|shore excursion|voyage|per person, double|check-in date|check-out|nights?|guests?|departure|flight|hotel|resort|booking|tour|rental car)\\b/g),
    goods: n(/\\b(add to (cart|bag|basket)|free shipping|returns?|size guide|in stock|sold out|colou?r|fit|delivery by|ships? within)\\b/g),
    ticketing: n(/\\b(tickets?|seats?|section|row|venue|doors open|general admission|box office|lineup|showtime)\\b/g),
    subscription: n(/\\b(per month|\\/mo|free trial|cancel anytime|subscription|billed (annually|monthly)|upgrade your plan|pricing plans?)\\b/g),
    services: n(/\\b(request a (quote|consultation)|get in touch|contact us today|our services|case stud(y|ies)|book a (call|demo))\\b/g),
    food: n(/\\b(delivery fee|order now|menu|takeaway|takeout|grocer|fresh|restaurant|minimum order)\\b/g),
  };
})()`;

export async function classifyVertical(page) {
  let signals = null;
  try {
    signals = await page.evaluate(VERTICAL_SCRIPT);
  } catch {
    return VERTICALS.generic;
  }
  if (!signals) return VERTICALS.generic;

  const href = signals.href || "";
  // A URL is stronger evidence than vocabulary when it is unambiguous.
  if (/cruise|hotel|flight|booking|travel|resort|voyage|tour/.test(href)) return VERTICALS.travel;

  const ranked = ["travel", "goods", "ticketing", "subscription", "services", "food"]
    .map((id) => ({ id, score: Number(signals[id] || 0) }))
    .sort((a, b) => b.score - a.score);

  const [top, second] = ranked;
  if (!top || top.score < 3) return VERTICALS.generic;
  // A clear winner needs to actually beat the runner-up; otherwise the page is
  // too mixed to make a confident claim, and generic is the honest answer.
  if (second && top.score < second.score * 1.4) return VERTICALS.generic;
  return VERTICALS[top.id];
}

/** The paragraph handed to every reviewer prompt. */
export function verticalBrief(vertical) {
  const v = vertical || VERTICALS.generic;
  return [
    `BUSINESS MODEL: ${v.name}.`,
    `BUYING TEMPERATURE: ${v.temperature}`,
    `A buyer here needs, at the decision point: ${v.expects.map((e) => `— ${e}`).join(" ")}`,
    `DO NOT ask this business for, or fault it for lacking: ${v.never.map((e) => `— ${e}`).join(" ")}`,
    `Use this category's own vocabulary. Using the wrong category's language (asking a cruise line about shipping, or a shoe store about cancellation policy) is a disqualifying error.`,
  ].join("\n");
}
