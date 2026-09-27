import { m } from "motion/react";
import { ChartColumn, Gift, Monitor, Moon, ReceiptText, Search, Settings2, Sun, Wallet, type LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { KeyboardHint } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { prefetchRoute } from "@/routes";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";

export const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Payday", icon: Wallet },
  { to: "/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/to-buy", label: "To-Buy", icon: Gift },
  { to: "/insights", label: "Insights", icon: ChartColumn },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useStore((s) => s.settings.theme);
  const update = useStore((s) => s.updateSettings);
  const next = theme === "paper" ? "workbench" : theme === "workbench" ? "system" : "paper";
  const Icon = theme === "paper" ? Sun : theme === "workbench" ? Moon : Monitor;
  const label = theme === "paper" ? "Paper" : theme === "workbench" ? "Workbench" : "System";
  return (
    <button
      type="button"
      onClick={() => update({ theme: next })}
      aria-label={`Theme: ${label}. Switch to ${next}`}
      title={`Theme: ${label}`}
      className={cn("grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink", className)}
    >
      <m.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
        <Icon className="size-[18px]" />
      </m.span>
    </button>
  );
}

function NavItem({ to, label, icon: Icon, compact }: (typeof NAV)[number] & { compact: boolean }) {
  const { pathname } = useLocation();
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <NavLink
      to={to}
      onMouseEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      onTouchStart={() => prefetchRoute(to)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center justify-center rounded-full font-medium transition-colors duration-200",
        compact ? "min-w-14 flex-1 flex-col gap-0.5 px-1 py-1 text-[11px]" : "gap-2 px-4 text-sm",
        active ? "text-accent-ink" : "text-muted hover:text-ink",
      )}
    >
      {active && (
        <m.span
          layoutId={compact ? "nav-pill-m" : "nav-pill"}
          className="absolute inset-0 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <Icon className="relative z-10 size-[18px]" aria-hidden />
      <span className="relative z-10">{label}</span>
    </NavLink>
  );
}

/** Floating pill nav on top (desktop), bottom dock (mobile). */
export function Dock() {
  const setPalette = useUi((s) => s.setPalette);
  return (
    <>
      <header className="fixed inset-x-0 top-4 z-40 hidden justify-center px-6 md:flex">
        <nav aria-label="Main" className="card flex items-center gap-1 rounded-full p-1.5 shadow-card backdrop-blur-md" style={{ background: "color-mix(in oklab, var(--surface) 86%, transparent)" }}>
          <span className="flex items-center gap-2 pl-3 pr-2 font-display text-xl italic" aria-label="Kinsenas">
            <span aria-hidden className="grid size-7 place-items-center rounded-full bg-highlight font-mono text-sm font-bold not-italic text-[#1a1916]">₱</span>
            <span className="hidden lg:inline">Kinsenas</span>
          </span>
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} compact={false} />
          ))}
          <span className="mx-1 h-6 w-px bg-line" aria-hidden />
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Open command palette"
          >
            <Search className="size-4" aria-hidden />
            <KeyboardHint keys={["Ctrl", "K"]} />
          </button>
          <ThemeToggle />
        </nav>
      </header>
      <nav
        aria-label="Main"
        className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 flex items-center gap-0.5 rounded-full border border-line p-1.5 shadow-drawer backdrop-blur-md md:hidden"
        style={{ background: "color-mix(in oklab, var(--surface) 90%, transparent)" }}
      >
        {NAV.map((n) => (
          <NavItem key={n.to} {...n} compact />
        ))}
      </nav>
    </>
  );
}
