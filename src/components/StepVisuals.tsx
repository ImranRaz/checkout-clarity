/**
 * StepVisuals — small schematic illustrations for the "How it works" steps.
 * Drawn with inline SVG so they inherit the design tokens and stay crisp.
 * Color convention matches the rest of the site: funnel agent = primary (green),
 * reputation agent = sev-medium (amber).
 */

/**
 * Step 01 — a URL bar that cycles through example domains (any site works),
 * with the caret pinned to the end of the word being typed.
 */
export function StepPointVisual() {
  const domains = ["yourbrand.com", "nike.com", "allbirds.com", "bombas.com", "amawaterways.com"];
  const per = 2.4; // seconds per domain
  const total = per * domains.length;
  return (
    <svg viewBox="0 0 240 120" className="h-auto w-full" role="img" aria-label="A URL being handed to the two agents">
      {/* address bar */}
      <rect x="16" y="14" width="208" height="34" rx="8" className="fill-muted/60 stroke-border" />
      <circle cx="30" cy="31" r="3" className="fill-muted-foreground/40" />
      <circle cx="40" cy="31" r="3" className="fill-muted-foreground/40" />
      <rect x="52" y="22" width="158" height="18" rx="9" className="fill-background stroke-border" />
      {domains.map((d, i) => {
        const caretX = 62 + d.length * 6.7 + 2;
        return (
          <g key={d} opacity="0">
            <animate
              attributeName="opacity"
              values="0;1;1;0;0"
              keyTimes={`0;${0.15 / total};${(per - 0.15) / total};${per / total};1`}
              dur={`${total}s`}
              begin={`${i * per}s`}
              repeatCount="indefinite"
            />
            <text x="62" y="35" className="fill-foreground font-mono" fontSize="11">
              {d}
            </text>
            <rect x={caretX} y="25" width="1.5" height="12" className="fill-primary">
              <animate attributeName="opacity" values="1;0;1" dur="1.1s" repeatCount="indefinite" />
            </rect>
          </g>
        );
      })}

      {/* drop line to the two agents */}
      <path d="M120 48 v12" className="stroke-border" strokeWidth="1.5" strokeDasharray="3 3" />
      <path d="M66 60 h108" className="stroke-border" strokeWidth="1.5" strokeDasharray="3 3" />
      <path d="M66 60 v10 M174 60 v10" className="stroke-border" strokeWidth="1.5" strokeDasharray="3 3" />

      {/* two agents catching it */}
      <g>
        <rect x="30" y="70" width="72" height="34" rx="8" className="fill-card stroke-border" />
        <circle cx="46" cy="87" r="7" className="fill-primary" />
        <path d="M43 87 l2.2 2.2 4-4" className="stroke-primary-foreground" strokeWidth="1.6" fill="none" />
        <text x="58" y="91" className="fill-foreground font-mono" fontSize="9">funnel</text>
      </g>
      <g>
        <rect x="138" y="70" width="72" height="34" rx="8" className="fill-card stroke-border" />
        <circle cx="154" cy="87" r="7" className="fill-sev-medium" />
        <path d="M151 87 l2.2 2.2 4-4" className="stroke-primary-foreground" strokeWidth="1.6" fill="none" />
        <text x="166" y="91" className="fill-foreground font-mono" fontSize="9">reviews</text>
      </g>
    </svg>
  );
}

/**
 * Step 02 — the funnel agent snakes through four small stops on your site
 * (home, products, product detail, cart) while the reputation agent reads
 * reviews one by one.
 */
export function StepAgentsVisual() {
  const stops = [
    { x: 26, y: 42, label: "home" },
    { x: 96, y: 34, label: "products" },
    { x: 30, y: 82, label: "detail" },
    { x: 96, y: 88, label: "cart" },
  ];
  const journey =
    "M26 42 C 55 26, 82 26, 96 34 C 108 42, 60 56, 40 66 C 22 74, 26 82, 30 82 C 40 96, 80 96, 96 88";
  return (
    <svg viewBox="0 0 240 120" className="h-auto w-full" role="img" aria-label="The funnel agent snakes through your site while the reputation agent collects reviews one by one">
      {/* left lane: funnel agent */}
      <text x="8" y="12" className="fill-primary font-mono" fontSize="8" fontWeight="bold">● FUNNEL AGENT</text>
      <text x="8" y="22" className="fill-muted-foreground font-mono" fontSize="7">shops your site</text>

      {/* snake path */}
      <path d={journey} className="stroke-primary/40" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeDasharray="3 3" />
      {/* small dot stops along the journey */}
      {stops.map((s) => (
        <g key={s.label}>
          <circle cx={s.x} cy={s.y} r="4.5" className="fill-card stroke-primary" strokeWidth="1.6" />
          <circle cx={s.x} cy={s.y} r="1.6" className="fill-primary" />
          <text x={s.x} y={s.y + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="6.5">
            {s.label}
          </text>
        </g>
      ))}
      {/* the agent travelling the path */}
      <circle r="3.5" className="fill-primary">
        <animateMotion dur="4s" repeatCount="indefinite" path={journey} />
      </circle>

      {/* divider */}
      <path d="M122 8 v104" className="stroke-border" strokeWidth="1" strokeDasharray="2 3" />

      {/* right lane: reputation agent */}
      <text x="132" y="12" className="fill-sev-medium font-mono" fontSize="8" fontWeight="bold">● REPUTATION AGENT</text>
      <text x="132" y="22" className="fill-muted-foreground font-mono" fontSize="7">reads your reviews</text>

      {/* reviews arriving one by one, good and bad */}
      {[
        { y: 30, stars: "★★★★★", tone: "fill-primary", w: 62, begin: "0s" },
        { y: 52, stars: "★★☆☆☆", tone: "fill-sev-high", w: 48, begin: "0.9s" },
        { y: 74, stars: "★★★☆☆", tone: "fill-sev-medium", w: 56, begin: "1.8s" },
        { y: 96, stars: "★★★★☆", tone: "fill-primary", w: 40, begin: "2.7s" },
      ].map((r) => (
        <g key={r.y} opacity="0">
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.85;1" dur="4.5s" begin={r.begin} repeatCount="indefinite" />
          <rect x="132" y={r.y} width="100" height="18" rx="5" className="fill-card stroke-border" />
          <text x="138" y={r.y + 8} className={r.tone} fontSize="6.5">{r.stars}</text>
          <rect x="138" y={r.y + 11} width={r.w} height="3" rx="1.5" className="fill-muted-foreground/30" />
        </g>
      ))}
    </svg>
  );
}

export function StepReportVisual() {
  return (
    <svg viewBox="0 0 240 120" className="h-auto w-full" role="img" aria-label="A scored report with findings pinned to the page and review quotes">
      {/* report card */}
      <rect x="24" y="8" width="192" height="104" rx="10" className="fill-card stroke-border" />
      {/* grade ring */}
      <circle cx="56" cy="40" r="18" className="stroke-muted" strokeWidth="5" fill="none" />
      <circle cx="56" cy="40" r="18" className="stroke-primary" strokeWidth="5" fill="none" strokeDasharray="113" strokeDashoffset="34" strokeLinecap="round" transform="rotate(-90 56 40)" />
      <text x="56" y="45" textAnchor="middle" className="fill-foreground font-display" fontSize="14">B–</text>
      <text x="82" y="36" className="fill-foreground font-mono" fontSize="9">Wayfarer Outdoor</text>
      <text x="82" y="48" className="fill-muted-foreground font-mono" fontSize="8">5 issues · 2 themes</text>

      {/* mini page with pinned finding */}
      <rect x="36" y="66" width="96" height="36" rx="5" className="fill-muted/50 stroke-border" />
      <rect x="42" y="72" width="40" height="4" rx="2" className="fill-muted-foreground/30" />
      <rect x="42" y="80" width="56" height="4" rx="2" className="fill-muted-foreground/20" />
      <rect x="42" y="88" width="30" height="8" rx="4" className="fill-primary/70" />
      {/* pin */}
      <g>
        <circle cx="112" cy="74" r="8" className="fill-sev-high" />
        <text x="112" y="77.5" textAnchor="middle" className="fill-primary-foreground font-mono" fontSize="8" fontWeight="bold">1</text>
        <path d="M104 82 h-14" className="stroke-sev-high" strokeWidth="1.4" strokeDasharray="2 2" />
      </g>

      {/* corroborating quote */}
      <rect x="140" y="66" width="66" height="36" rx="5" className="fill-muted/50 stroke-border" />
      <text x="146" y="76" className="fill-sev-medium" fontSize="7">★★☆☆☆</text>
      <rect x="146" y="80" width="52" height="3" rx="1.5" className="fill-muted-foreground/30" />
      <rect x="146" y="86" width="40" height="3" rx="1.5" className="fill-muted-foreground/20" />
      <text x="146" y="98" className="fill-muted-foreground font-mono" fontSize="6.5">“fees at the end”</text>
    </svg>
  );
}
