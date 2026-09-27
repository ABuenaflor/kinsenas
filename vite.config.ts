/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

/** Lazy chunks a visit may need right away, keyed by the module that starts them. */
const CRITICAL = {
  routes: {
    "/": "src/features/payday/PaydayPage.tsx",
    "/expenses": "src/features/expenses/ExpensesPage.tsx",
    "/to-buy": "src/features/tobuy/ToBuyPage.tsx",
    "/insights": "src/features/insights/InsightsPage.tsx",
    "/settings": "src/features/settings/SettingsPage.tsx",
  } as Record<string, string>,
  motion: "src/motion/features.ts",
  onboarding: "src/features/onboarding/Onboarding.tsx",
};

/**
 * Lazy route/feature chunks are normally discovered only after the main bundle
 * runs. This injects a tiny inline script that modulepreloads just what this
 * visit needs (its route, Motion's features, onboarding on first run), so those
 * downloads overlap with the main bundle instead of following it.
 */
function preloadCriticalChunks(): Plugin {
  return {
    name: "kinsenas:preload-critical-chunks",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const chunks = Object.values(bundle).filter((c) => c.type === "chunk");
        const entry = chunks.find((c) => c.isEntry)?.fileName;
        const filesFor = (src: string): string[] => {
          const chunk = chunks.find((c) => c.facadeModuleId?.replace(/\\/g, "/").endsWith(src));
          if (!chunk) throw new Error(`preload-critical-chunks: no chunk for ${src}`);
          return [chunk.fileName, ...chunk.imports.filter((f) => f !== entry)];
        };
        const map = {
          routes: Object.fromEntries(Object.entries(CRITICAL.routes).map(([path, src]) => [path, filesFor(src)])),
          motion: filesFor(CRITICAL.motion),
          onboarding: filesFor(CRITICAL.onboarding),
        };
        const script = `(function(){var m=${JSON.stringify(map)};var seen={};function add(fs){fs.forEach(function(f){if(seen[f])return;seen[f]=1;var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href="/"+f;document.head.appendChild(l);});}
add(m.motion);var p=location.pathname.replace(/\\/+$/,"")||"/";add(m.routes[p]||m.routes["/"]);
try{var s=JSON.parse(localStorage.getItem("kinsenas:v1")||"{}");if(!(s.state&&s.state.settings&&s.state.settings.onboardingDone))add(m.onboarding);}catch(e){add(m.onboarding);}})();`;
        return [{ tag: "script", children: script, injectTo: "head" }];
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadCriticalChunks()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Spline runtime chunks are large but lazy (idle-loaded, desktop only).
  build: { chunkSizeWarningLimit: 700 },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
