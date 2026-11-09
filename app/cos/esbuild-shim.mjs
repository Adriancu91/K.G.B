// Stand-in for esbuild's `build` in the copied tests: the "bundle" is a file that re-exports the entry
// (Node loads the TypeScript itself, through hooks.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function build(opts) {
  // Several entries into a folder (outdir): one re-export file per entry, named as esbuild names them.
  if (opts.outdir && !opts.outfile) {
    // Like esbuild, the outputs keep their folders below the entries' lowest common folder (src/docs/x.ts and
    // src/sheets/y.ts → <outdir>/docs/x.js, <outdir>/sheets/y.js).
    const abs = opts.entryPoints.map((e) => (isAbsolute(e) ? e : resolve(process.cwd(), e)).split(/[\\/]/));
    let common = abs[0].length - 1;
    for (const parts of abs) {
      let i = 0;
      while (i < common && i < parts.length - 1 && parts[i] === abs[0][i]) i++;
      common = i;
    }
    for (const parts of abs) {
      const out = resolve(opts.outdir, ...parts.slice(common)).replace(/\.[^.\\/]+$/, ".js");
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `export * from ${JSON.stringify(pathToFileURL(parts.join("/")).href)};\n`);
    }
    return { errors: [], warnings: [] };
  }
  mkdirSync(dirname(opts.outfile), { recursive: true });
  if (opts.stdin) {
    // Source given inline: its relative imports are relative to resolveDir.
    const dir = opts.stdin.resolveDir ?? process.cwd();
    const code = opts.stdin.contents.replace(/(['"])(\.{1,2}\/[^'"]+)\1/g, (_, q, p) => JSON.stringify(pathToFileURL(resolve(dir, p)).href));
    writeFileSync(opts.outfile, code);
    return { errors: [], warnings: [] };
  }
  const entry = opts.entryPoints[0];
  const abs = isAbsolute(entry) ? entry : resolve(process.cwd(), entry);
  writeFileSync(opts.outfile, `export * from ${JSON.stringify(pathToFileURL(abs).href)};\n`);
  return { errors: [], warnings: [] };
}
