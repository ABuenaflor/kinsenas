import { motion } from "motion/react";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { parseBps, parseMoney } from "@/lib/money";
import type { Bps, Centavos } from "@/domain/types";

/* ---------------- Field ---------------- */

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn("field w-full", className)} {...props} />;
});

/* ---------------- MoneyInput ---------------- */

/** Keep only digits and one dot (≤ 2 decimals), then add thousands separators. */
function formatTyping(raw: string): string {
  let s = raw.replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  const [whole = "", frac] = s.split(".");
  const w = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac !== undefined ? `${w || "0"}.${frac}` : w;
}

function toText(c: Centavos | null): string {
  if (c === null) return "";
  const whole = Math.trunc(c / 100);
  const frac = Math.abs(c % 100);
  return formatTyping(`${whole}${frac ? `.${String(frac).padStart(2, "0")}` : ""}`);
}

export interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size"> {
  value: Centavos | null;
  onValueChange: (v: Centavos | null) => void;
  size?: "md" | "lg" | "hero";
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, size = "md", className, ...props },
  ref,
) {
  const [text, setText] = useState(() => toText(value));
  const last = useRef<Centavos | null>(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(toText(value));
    }
  }, [value]);
  const sizes = {
    md: "text-base min-h-11",
    lg: "text-2xl min-h-14",
    hero: "text-4xl md:text-5xl min-h-20",
  };
  return (
    <div className={cn("field flex items-center gap-2", sizes[size], className)}>
      <span aria-hidden className={cn("money text-muted", size === "hero" && "text-3xl md:text-4xl")}>
        ₱
      </span>
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        className="money w-full min-w-0 bg-transparent py-2 outline-none placeholder:text-muted/60"
        value={text}
        onChange={(e) => {
          const t = formatTyping(e.target.value);
          setText(t);
          const parsed = t === "" ? null : parseMoney(t);
          last.current = parsed;
          onValueChange(parsed);
        }}
        {...props}
      />
    </div>
  );
});

/* ---------------- PercentInput ---------------- */

export function PercentInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: Bps; onValueChange: (v: Bps) => void }) {
  const [text, setText] = useState(() => (value / 100).toString());
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText((value / 100).toString());
    }
  }, [value]);
  return (
    <div className={cn("field flex items-center gap-1", className)}>
      <input
        inputMode="decimal"
        className="money w-full min-w-0 bg-transparent text-right outline-none"
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, "");
          setText(t);
          const p = parseBps(t);
          if (p !== null && p <= 10000) {
            last.current = p;
            onValueChange(p);
          }
        }}
        onBlur={() => setText((last.current / 100).toString())}
        {...props}
      />
      <span aria-hidden className="money text-muted">
        %
      </span>
    </div>
  );
}

/* ---------------- Select (native, styled) ---------------- */

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className={cn("relative", className)}>
      <select ref={ref} className="field w-full appearance-none pr-9" {...props}>
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});

/* ---------------- Switch ---------------- */

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <span id={`${id}-l`} className="block text-sm font-medium">
          {label}
        </span>
        {description && (
          <span id={`${id}-d`} className="block text-xs text-muted">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-40"
      >
        <span className={cn("absolute h-7 w-12 rounded-full transition-colors duration-200", checked ? "bg-ink" : "bg-line")} />
        <motion.span
          initial={false}
          animate={{ x: checked ? 10 : -10 }}
          transition={{ type: "spring", stiffness: 600, damping: 35 }}
          className="relative size-5 rounded-full bg-surface shadow-sm"
        />
      </button>
    </div>
  );
}

/* ---------------- SegmentedControl ---------------- */

export interface Segment<T extends string> {
  value: T;
  label: ReactNode;
  color?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
  layoutId,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly Segment<T>[];
  label: string;
  className?: string;
  size?: "sm" | "md";
  layoutId?: string;
}) {
  const fallbackId = useId();
  const pillId = layoutId ?? `seg-${fallbackId}`;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + options.length) % options.length;
    const opt = options[next];
    if (opt) {
      onChange(opt.value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-full bg-surface-2 p-1", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative flex-1 rounded-full px-3 font-medium transition-colors duration-200",
              size === "sm" ? "min-h-9 text-[13px]" : "min-h-10 text-sm",
              active ? "text-accent-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-full bg-accent"
                style={o.color ? { background: o.color } : undefined}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
