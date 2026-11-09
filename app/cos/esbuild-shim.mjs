// Stand-in for esbuild's `build` in the copied tests: the "bundle" is a file that re-exports the entry
// (Node loads the TypeScript itself, through hooks.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function build(opts) {
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
