import { m, useMotionValue, useSpring, type HTMLMotionProps } from "motion/react";
import { forwardRef, type ReactNode } from "react";
import { useFinePointer, useReduced } from "@/hooks/useMedia";
import { cn } from "@/lib/cn";

type Variant = "solid" | "ghost" | "outline" | "danger" | "highlight";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  solid: "bg-accent text-accent-ink hover:opacity-90",
  highlight: "bg-highlight text-[#1a1916] hover:brightness-95",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  outline: "bg-transparent text-ink border border-line hover:border-ink",
  danger: "bg-danger text-[var(--danger-ink)] hover:opacity-90",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm gap-1.5 rounded-[10px]",
  md: "min-h-11 px-4 text-[15px] gap-2 rounded-md",
  lg: "min-h-13 px-6 text-base gap-2 rounded-md",
  icon: "size-11 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "solid", size = "md", className, type = "button", ...props },
  ref,
) {
  return (
    <m.button
      ref={ref}
      type={type}
      whileTap={props.disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background,opacity,border-color,filter] duration-200 ease-out disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

/** Primary button that leans toward the cursor (max 6px). */
export const MagneticButton = forwardRef<HTMLButtonElement, ButtonProps>(function MagneticButton(props, ref) {
  const fine = useFinePointer();
  const reduced = useReduced();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 300, damping: 20 });
  const y = useSpring(my, { stiffness: 300, damping: 20 });
  const active = fine && !reduced;
  return (
    <Button
      ref={ref}
      {...props}
      style={active ? { x, y, ...props.style } : props.style}
      onPointerMove={(e) => {
        props.onPointerMove?.(e);
        if (!active) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width - 0.5) * 12);
        my.set(((e.clientY - r.top) / r.height - 0.5) * 12);
      }}
      onPointerLeave={(e) => {
        props.onPointerLeave?.(e);
        mx.set(0);
        my.set(0);
      }}
    />
  );
});
