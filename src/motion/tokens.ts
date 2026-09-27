export const ease = { out: [0.22, 1, 0.36, 1], inOut: [0.65, 0, 0.35, 1] } as const;
export const dur = { fast: 0.15, base: 0.25, page: 0.32, slow: 0.5 } as const;
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 35 },
  soft: { type: "spring", stiffness: 220, damping: 26 },
  bouncy: { type: "spring", stiffness: 380, damping: 18 },
} as const;
