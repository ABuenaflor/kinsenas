import type { Variants } from "motion/react";
import { dur, ease } from "./tokens";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
};

export const stagger = (step = 0.04, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const blurIn: Variants = {
  hidden: { opacity: 0, filter: "blur(6px)", y: 6 },
  show: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: dur.slow, ease: ease.out } },
};

export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 500, damping: 30 } },
};

export const printLine: Variants = {
  hidden: { opacity: 0, y: -6, clipPath: "inset(0 0 100% 0)" },
  show: { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", transition: { duration: 0.22, ease: ease.out } },
};

export const shake = { x: [0, -4, 4, -2, 0], transition: { duration: 0.35 } };
