/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  forbidden: [
    {
      comment: "Cycles are forbidden.",
      from: {},
      name: "no-circular",
      severity: "error",
      to: { circular: true },
    },
    {
      comment:
        "The frontend does not import the backend. The only shared code is the generated contract in spec/.",
      from: { path: "^frontend/" },
      name: "no-frontend-to-backend",
      severity: "error",
      to: { path: "^backend/" },
    },
    {
      comment:
        "The backend does not import the frontend. The only shared code is the generated contract in spec/.",
      from: { path: "^backend/" },
      name: "no-backend-to-frontend",
      severity: "error",
      to: { path: "^frontend/" },
    },
    {
      comment:
        "Frontend and backend may import from spec/ only the generated contract (spec/api.d.ts and spec/openapi.yaml).",
      from: { path: "^(frontend|backend)/" },
      name: "apps-only-generated-spec",
      severity: "error",
      to: {
        path: "^spec/",
        pathNot: String.raw`^spec/(api\.d\.ts|openapi\.yaml)$`,
      },
    },
    {
      comment:
        "Production code does not import devDependencies. Type-only imports are erased and do not count.",
      from: {
        path: "^(frontend/src|backend/src)/",
        pathNot: String.raw`\.(?:spec|test)\.(?:ts|tsx)$|^frontend/src/test-setup\.ts$`,
      },
      name: "not-to-dev-dep",
      severity: "error",
      to: {
        dependencyTypes: ["npm-dev"],
        dependencyTypesNot: ["type-only"],
        pathNot: ["node_modules/@types/"],
      },
    },
    // No-orphans is intentionally absent: unused files are Knip's job.
  ],
  options: {
    combinedDependencies: true,
    doNotFollow: {
      path: ["node_modules", String.raw`^spec/openapi\.yaml$`, String.raw`^spec/api\.d\.ts$`],
    },
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default", "types"],
      exportsFields: ["exports"],
      mainFields: ["module", "main"],
    },
    exclude: {
      path: ["(^|/)dist/", "^backend/drizzle/"],
    },
    parser: "swc",
    tsPreCompilationDeps: true,
  },
};

export default config;
