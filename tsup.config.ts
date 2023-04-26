import { defineConfig } from "tsup";
import type { Options } from "tsup";

import pkgJSON from "./package.json";

// @ts-ignore shhhh
let external = Object.keys(pkgJSON.dependencies || {});

let shared_options: Options = {
  entry: ["src/index.ts"],
  sourcemap: true,
  external,
  tsconfig: "./tsconfig.json",
};

export default defineConfig(() => {
  return [
    { ...shared_options, format: "cjs" },

    { ...shared_options, format: "esm", dts: true },
  ];
});
