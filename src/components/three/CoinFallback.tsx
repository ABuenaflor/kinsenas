import { m, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { useReduced } from "@/hooks/useMedia";

/** Hand-built CSS/SVG coin stack that tilts toward the cursor and hops on save. */
export function CoinFallback({ saveSignal = 0 }: { saveSignal?: number }) {
  const reduced = useReduced();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [14, -14]), { stiffness: 120, damping: 14 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-18, 18]), { stiffness: 120, damping: 14 });
  const hop = useMotionValue(0);
  const hopY = useSpring(hop, { stiffness: 400, damping: 12 });

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      mx.set(Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 500)));
      my.set(Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / 500)));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my, reduced]);

  useEffect(() => {
    if (!saveSignal || reduced) return;
    hop.set(-26);
    const t = setTimeout(() => hop.set(0), 140);
    return () => clearTimeout(t);
  }, [saveSignal, hop, reduced]);

  const coins = [0, 1, 2, 3, 4];
  return (
    <div ref={ref} className="relative grid h-44 w-44 place-items-center [perspective:600px]" aria-hidden>
      <div className="absolute bottom-3 h-5 w-32 rounded-[50%] bg-ink/10 blur-md" />
      <m.div style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} className="relative h-36 w-32">
        {coins.map((i) => (
          <div
            key={i}
            className="absolute left-1/2 h-9 w-28 -translate-x-1/2 rounded-[50%] border-2 border-[#a8871c]"
            style={{
              bottom: i * 11,
              background: "linear-gradient(180deg, #f6dc6b 0%, #e5bd33 55%, #b8921f 100%)",
              boxShadow: "inset 0 -5px 0 rgb(0 0 0 / 0.12), 0 2px 0 #9b7a14",
              rotate: `${(i % 2 ? 1 : -1) * (i * 1.5)}deg`,
            }}
          />
        ))}
        <m.div
          style={{ y: hopY, z: 30 }}
          className="absolute -top-2 left-[calc(50%-40px)] grid size-20 place-items-center rounded-full border-[3px] border-[#a8871c] font-mono text-3xl font-bold text-[#6f5710]"
        >
          <span
            className="grid size-full place-items-center rounded-full"
            style={{ background: "radial-gradient(circle at 35% 30%, #fff3b0 0%, #f2d14b 40%, #d4a92a 100%)", boxShadow: "inset 0 0 0 5px rgb(255 255 255 / 0.25)" }}
          >
            ₱
          </span>
        </m.div>
      </m.div>
    </div>
  );
}
