import { cn } from "@/lib/utils";

/**
 * Brand mark: a conversion funnel drawn as three descending rails with a
 * single pinpoint dropped on the last one — the journey narrowing, and the
 * exact place it breaks. Flat, geometric, no gloss.
 */
export function BrandGlyph({ className }: { className?: string | undefined }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-hidden
      className={cn("size-7", className)}
      fill="none"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <rect x="7" y="9" width="18" height="2.5" rx="1.25" className="fill-primary-foreground" />
      <rect
        x="10"
        y="14.75"
        width="12"
        height="2.5"
        rx="1.25"
        className="fill-primary-foreground"
        opacity="0.72"
      />
      <rect
        x="13"
        y="20.5"
        width="6"
        height="2.5"
        rx="1.25"
        className="fill-primary-foreground"
        opacity="0.45"
      />
      <circle cx="22.5" cy="21.75" r="3.75" className="fill-primary" />
      <circle cx="22.5" cy="21.75" r="2.6" className="fill-primary-foreground" />
    </svg>
  );
}

export function BrandLockup({
  className,
  glyphClassName,
}: {
  className?: string;
  glyphClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandGlyph className={glyphClassName} />
      <span className="font-display text-[15px] font-semibold leading-none tracking-tight">
        Checkout<span className="text-primary">Forensic</span>
      </span>
    </span>
  );
}
