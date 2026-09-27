import { m } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useIsDesktop } from "@/hooks/useMedia";

/** Settings section: always open on desktop, an accordion on mobile. */
export function Section({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const expanded = desktop || open;
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="card scroll-mt-28 p-0">
      <h2 id={`${id}-h`} className="text-lg font-semibold tracking-tight">
        {desktop ? (
          <span className="block px-5 pt-5 md:px-6 md:pt-6">{title}</span>
        ) : (
          <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)} className="flex min-h-14 w-full items-center justify-between px-5 text-left">
            {title}
            <m.span animate={{ rotate: open ? 180 : 0 }}>
              <ChevronDown className="size-5 text-muted" />
            </m.span>
          </button>
        )}
      </h2>
      {expanded && (
        <div id={bodyId} className="px-5 pb-5 pt-1 md:px-6 md:pb-6">
          {description && <p className="mb-4 text-sm text-muted">{description}</p>}
          {children}
        </div>
      )}
    </section>
  );
}
