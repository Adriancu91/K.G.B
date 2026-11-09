// Runs the tests copied from Cyber Office Studio as they are (D-071): they bundle TypeScript with esbuild, which
// K.G.B. does not have. Node 24 reads TypeScript itself, so here `esbuild`'s `build` only writes a file that
// re-exports the entry, extensionless imports resolve to `.ts`, and `.svg` files load as text.
// Use (in app/cos/): node --import ./hooks.mjs tests/notes-pages.test.mjs
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const shim = new URL("./esbuild-shim.mjs", import.meta.url).href;
// TypeScript → JavaScript with oxc (from rolldown, already in the app through vite): like esbuild, it drops the
// imports that are only types, which Node's own type stripping cannot know.
const { transformSync } = await import(pathToFileURL(createRequire(import.meta.url).resolve("rolldown/experimental")).href);
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "esbuild") return { url: shim, shortCircuit: true };
    // The tests' entry files name sources by absolute Windows paths (C:/…), as esbuild allows.
    if (/^[A-Za-z]:[\/]/.test(spec)) return next(pathToFileURL(spec).href, ctx);
    try {
      return next(spec, ctx);
    } catch (e) {
      if (spec.startsWith(".") && !/\.[a-z0-9]+$/i.test(spec)) return next(`${spec}.ts`, ctx);
      throw e;
    }
  },
  load(url, ctx, next) {
    if (url.endsWith(".svg")) {
      const { readFileSync } = process.getBuiltinModule("node:fs");
      return { format: "module", source: `export default ${JSON.stringify(readFileSync(fileURLToPath(url), "utf8"))};`, shortCircuit: true };
    }
    if (url.endsWith(".ts") && url.startsWith("file:")) {
      const { readFileSync } = process.getBuiltinModule("node:fs");
      const file = fileURLToPath(url);
      const out = transformSync(file, readFileSync(file, "utf8"), { lang: "ts", sourceType: "module" });
      if (out.errors?.length) throw new Error(`${file}: ${out.errors.map((e) => e.message).join("; ")}`);
      return { format: "module", source: out.code, shortCircuit: true };
    }
    return next(url, ctx);
  },
});
