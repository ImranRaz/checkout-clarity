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

export function StepAgentsVisual() {
  return (
    <svg viewBox="0 0 240 120" className="h-auto w-full" role="img" aria-label="Two agents working in parallel — one shopping the site, one reading reviews">
      {/* left lane: funnel agent shopping */}
      <rect x="8" y="10" width="110" height="100" rx="10" className="fill-muted/40 stroke-border" />
      <text x="18" y="26" className="fill-muted-foreground font-mono" fontSize="8">ON YOUR SITE</text>
      {/* journey dots */}
      <path d="M26 78 h20 l10 -18 h18 l10 22 h14" className="stroke-primary" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26" cy="78" r="3.5" className="fill-primary" />
      <circle cx="56" cy="60" r="3.5" className="fill-primary" />
      <circle cx="84" cy="82" r="3.5" className="fill-primary" />
      {/* flag at checkout */}
      <circle cx="98" cy="82" r="4" className="fill-card stroke-primary" strokeWidth="1.6" />
      <text x="18" y="102" className="fill-foreground font-mono" fontSize="8">home → product → cart</text>

      {/* right lane: reputation agent reading reviews */}
      <rect x="122" y="10" width="110" height="100" rx="10" className="fill-muted/40 stroke-border" />
      <text x="132" y="26" className="fill-muted-foreground font-mono" fontSize="8">OFF YOUR SITE</text>
      {/* review cards */}
      <g>
        <rect x="132" y="34" width="90" height="20" rx="5" className="fill-card stroke-border" />
        <text x="138" y="44" className="fill-sev-medium" fontSize="7">★★★★☆</text>
        <rect x="138" y="47" width="66" height="3" rx="1.5" className="fill-muted-foreground/30" />
      </g>
      <g>
        <rect x="132" y="58" width="90" height="20" rx="5" className="fill-card stroke-border" />
        <text x="138" y="68" className="fill-sev-medium" fontSize="7">★★☆☆☆</text>
        <rect x="138" y="71" width="52" height="3" rx="1.5" className="fill-muted-foreground/30" />
      </g>
      {/* scanning highlight */}
      <rect x="132" y="82" width="90" height="20" rx="5" className="fill-card stroke-sev-medium" strokeWidth="1.6" />
      <text x="138" y="92" className="fill-sev-medium" fontSize="7">★★★☆☆</text>
      <rect x="138" y="95" width="70" height="3" rx="1.5" className="fill-sev-medium/40" />
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
        <circle cx="112" cy="74" r="8" className="fill-sev-critical" />
        <text x="112" y="77.5" textAnchor="middle" className="fill-primary-foreground font-mono" fontSize="8" fontWeight="bold">1</text>
        <path d="M104 82 h-14" className="stroke-sev-critical" strokeWidth="1.4" strokeDasharray="2 2" />
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
