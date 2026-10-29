import type { KnipConfig } from "knip";

// Generated files are not Knip sources.
// Declarations, OpenAPI and SQL stay out of the module graph.
const config: KnipConfig = {
  ignoreDependencies: [
    // Imported from spec/*.tsp and spec/tspconfig.yaml. Knip does not read TypeSpec.
    "@typespec/http",
    "@typespec/openapi",
    "@typespec/openapi3",
  ],
  workspaces: {
    frontend: {
      // The typed client has no caller until the booking screens. It is the module they will import.
      entry: ["src/api.ts"],
    },
  },
};

export default config;
