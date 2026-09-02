/**
 * StepVisuals — small schematic illustrations for the "How it works" steps.
 * Drawn with inline SVG so they inherit the design tokens and stay crisp.
 * Color convention matches the rest of the site: funnel agent = primary (green),
 * reputation agent = sev-medium (amber).
 */

export function StepPointVisual() {
  return (
    <svg viewBox="0 0 240 120" className="h-auto w-full" role="img" aria-label="A URL being handed to the two agents">
      {/* address bar */}
      <rect x="16" y="14" width="208" height="34" rx="8" className="fill-muted/60 stroke-border" />
      <circle cx="30" cy="31" r="3" className="fill-muted-foreground/40" />
      <circle cx="40" cy="31" r="3" className="fill-muted-foreground/40" />
      <rect x="52" y="22" width="158" height="18" rx="9" className="fill-background stroke-border" />
      <text x="62" y="35" className="fill-foreground font-mono" fontSize="11">
        yourbrand.com
      </text>
      {/* caret */}
      <rect x="138" y="25" width="1.5" height="12" className="fill-primary">
        <animate attributeName="opacity" values="1;0;1" dur="1.1s" repeatCount="indefinite" />
      </rect>

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
 * A small octagon node, echoing the journey loop in the hero.
 */
function OctNode({ x, y, label, tone = "primary" }: { x: number; y: number; label: string; tone?: "primary" | "sev-medium" }) {
  const r = 11;
  const k = r * 0.42;
  const pts = [
    [x - k, y - r],
    [x + k, y - r],
    [x + r, y - k],
    [x + r, y + k],
    [x + k, y + r],
    [x - k, y + r],
    [x - r, y + k],
    [x - r, y - k],
  ]
    .map(([px, py]) => `${px},${py}`)
    .join(" ");
  return (
    <g>
      <polygon points={pts} className={`fill-card ${tone === "primary" ? "stroke-primary" : "stroke-sev-medium"}`} strokeWidth="1.6" />
      <circle cx={x} cy={y} r="3" className={tone === "primary" ? "fill-primary" : "fill-sev-medium"} />
      <text x={x} y={y + r + 9} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="6.5">
        {label}
      </text>
    </g>
  );
}

export function StepAgentsVisual() {
  // Snake path through the three funnel stops: home (top-left) → product (right) → cart (bottom-left)
  const journey = "M30 34 C 60 20, 90 26, 96 40 C 100 52, 60 56, 44 62 C 28 68, 30 82, 52 86";
  return (
    <svg viewBox="0 0 240 120" className="h-auto w-full" role="img" aria-label="The funnel agent snakes through your site while the reputation agent collects reviews one by one">
      {/* left lane: funnel agent */}
      <text x="8" y="12" className="fill-primary font-mono" fontSize="8" fontWeight="bold">● FUNNEL AGENT</text>
      <text x="8" y="22" className="fill-muted-foreground font-mono" fontSize="7">shops your site</text>

      {/* snake path */}
      <path d={journey} className="stroke-primary/40" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeDasharray="3 3" />
      {/* octagon stops, matching the hero loop */}
      <OctNode x={30} y={34} label="home" />
      <OctNode x={96} y={40} label="product" />
      <OctNode x={52} y={86} label="cart" />
      {/* the agent travelling the path */}
      <circle r="3.5" className="fill-primary">
        <animateMotion dur="3.2s" repeatCount="indefinite" path={journey} />
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
