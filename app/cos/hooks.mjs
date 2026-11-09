// Runs the tests copied from Cyber Office Studio as they are (D-071): they bundle TypeScript with esbuild, which
// K.G.B. does not have. Node 24 reads TypeScript itself, so here `esbuild`'s `build` only writes a file that
// re-exports the entry, extensionless imports resolve to `.ts`, and `.svg` files load as text.
// Use (in app/cos/): node --import ./hooks.mjs tests/notes-pages.test.mjs
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = new URL("../package.json", import.meta.url).href;
const shim = new URL("./esbuild-shim.mjs", import.meta.url).href;
// TypeScript → JavaScript with oxc (from rolldown, already in the app through vite): like esbuild, it drops the
// imports that are only types, which Node's own type stripping cannot know.
const { transformSync } = await import(pathToFileURL(createRequire(import.meta.url).resolve("rolldown/experimental")).href);
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "esbuild") return { url: shim, shortCircuit: true };
    // The tests' entry files name sources by absolute Windows paths (C:/…), as esbuild allows.
    if (/^[A-Za-z]:[\\/]/.test(spec)) return next(pathToFileURL(spec).href, ctx);
    // Vite's `?url` imports (fonts, workers): the file's own path, as a string.
    if (spec.endsWith("?url")) {
      const r = next(spec.slice(0, -4), ctx.parentURL?.startsWith("file:") ? ctx : { ...ctx, parentURL: appRoot });
      return { ...r, url: `${r.url}?url`, format: "module", shortCircuit: true };
    }
    try {
      return next(spec, ctx);
    } catch (e) {
      if (spec.startsWith(".") && !/\.[a-z0-9]+$/i.test(spec)) {
        // `./x` is x.ts, x.tsx or the folder x with its index.ts, as the bundler resolves it.
        for (const tail of [".ts", ".tsx", "/index.ts"]) {
          try {
            return next(`${spec}${tail}`, ctx);
          } catch {
            /* try the next form */
          }
        }
      }
      // Packages named from a temporary entry file (outside the app) resolve from the app's node_modules.
      if (!spec.startsWith(".") && !spec.startsWith("file:") && !spec.startsWith("node:")) return next(spec, { ...ctx, parentURL: appRoot });
      throw e;
    }
  },
  load(url, ctx, next) {
    if (url.endsWith("?url")) {
      return { format: "module", source: `export default ${JSON.stringify(fileURLToPath(url.slice(0, -4)))};`, shortCircuit: true };
    }
    if (url.endsWith(".svg")) {
      const { readFileSync } = process.getBuiltinModule("node:fs");
      return { format: "module", source: `export default ${JSON.stringify(readFileSync(fileURLToPath(url), "utf8"))};`, shortCircuit: true };
    }
    if (/\.tsx?$/.test(url) && url.startsWith("file:")) {
      const { readFileSync } = process.getBuiltinModule("node:fs");
      const file = fileURLToPath(url);
      const tsx = url.endsWith(".tsx");
      // .tsx (dialogs imported by the logic under test): JSX with React's automatic runtime, as Vite builds it.
      const out = transformSync(file, readFileSync(file, "utf8"), { lang: tsx ? "tsx" : "ts", sourceType: "module", ...(tsx ? { jsx: { runtime: "automatic" } } : {}) });
      if (out.errors?.length) throw new Error(`${file}: ${out.errors.map((e) => e.message).join("; ")}`);
      return { format: "module", source: out.code, shortCircuit: true };
    }
    return next(url, ctx);
  },
});
