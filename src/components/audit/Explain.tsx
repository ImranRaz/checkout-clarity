import { HelpCircle } from "lucide-react";
import { useId, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GLOSSARY, type GlossaryEntry, type GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/**
 * A teaching affordance. Hover opens it on pointer devices, click/keyboard
 * opens it everywhere else, so the same control works on a phone and in a
 * screen reader. Hidden from print.
 */
export function Explain({ term, className }: { term: GlossaryKey; className?: string }) {
  const [open, setOpen] = useState(false);
  const entry: GlossaryEntry = GLOSSARY[term];
  const id = useId();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${entry.term}?`}
          aria-describedby={open ? id : undefined}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className={cn(
            "no-print inline-flex shrink-0 items-center text-muted-foreground/70 transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none",
            className,
          )}
        >
          <HelpCircle className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        id={id}
        align="start"
        side="top"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="no-print w-80 max-w-[calc(100vw-2rem)] p-4 text-left"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
          {entry.term}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{entry.what}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{entry.why}</p>
        {entry.benchmark && (
          <p className="mt-3 rounded-md bg-secondary px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground">
            {entry.benchmark}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
