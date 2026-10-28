// Fails when the committed openapi.yaml differs from a fresh TypeSpec compile. CI will run it (ADR-0001).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outDir = mkdtempSync(join(tmpdir(), "openapi-check-"));
try {
  execFileSync("tsp", ["compile", ".", "--option", `@typespec/openapi3.emitter-output-dir=${outDir}`], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  const fresh = readFileSync(join(outDir, "openapi.yaml"), "utf8");
  const committed = readFileSync("openapi.yaml", "utf8");
  if (fresh !== committed) {
    console.error("spec/openapi.yaml is out of date with the TypeSpec sources. Run `pnpm spec:build` and commit it.");
    process.exit(1);
  }
  console.log("spec/openapi.yaml is up to date.");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
