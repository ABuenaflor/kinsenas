import { useRef, type HTMLAttributes } from "react";
import { useFinePointer } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card p-5 md:p-6", className)} {...props} />;
}

/** Card with a cursor-following radial glow on desktop hover. */
export function SpotlightCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  return (
    <div
      ref={ref}
      className={cn("card group/spot relative overflow-hidden p-5 md:p-6", className)}
      onPointerMove={(e) => {
        if (!fine || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      {...props}
    >
      {fine && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
          style={{
            background:
              "radial-gradient(360px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, var(--highlight) 16%, transparent), transparent 70%)",
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

export function SectionTitle({ eyebrow, title, action, className }: { eyebrow?: string; title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}
