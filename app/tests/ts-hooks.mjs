// For the tests: Node 24 reads TypeScript directly, but the code copied from Cyber Office Studio imports its
// neighbours without the extension (`./textRemove`), as a bundler allows. This resolves those to `.ts`.
import { registerHooks } from "node:module";

registerHooks({
  resolve(spec, ctx, next) {
    try {
      return next(spec, ctx);
    } catch (e) {
      if (spec.startsWith(".") && !/\.[a-z]+$/i.test(spec)) return next(`${spec}.ts`, ctx);
      throw e;
    }
  },
});
