import { cn } from "@/lib/utils";
import { severityLabel, type Severity } from "@/lib/audit-schema";

const styles: Record<Severity, string> = {
  high: "bg-sev-high-soft text-sev-high border-sev-high/25",
  medium: "bg-sev-medium-soft text-sev-medium border-sev-medium/25",
  low: "bg-sev-low-soft text-sev-low border-sev-low/25",
};

export function SeverityChip({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        styles[severity],
        className,
      )}
    >
      {severityLabel[severity]}
    </span>
  );
}
