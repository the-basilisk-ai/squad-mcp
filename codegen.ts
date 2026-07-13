import type { CodegenConfig } from "@graphql-codegen/cli";

// schema.graphql is a committed snapshot of the Squad platform API schema.
// Refresh: copy packages/graphql/src/schema/generated.graphql from the API
// repo (or set SQUAD_GRAPHQL_URL to introspect a live endpoint) and rerun
// `yarn codegen`. `yarn codegen:check` fails CI when src/gql/ is stale.
const config: CodegenConfig = {
  overwrite: true,
  schema: process.env.SQUAD_GRAPHQL_URL || "./schema.graphql",
  documents: ["./src/graphql/**/*.graphql"],
  generates: {
    "./src/gql/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        scalars: { DateTime: "string", BigInt: "string", JSON: "unknown" },
        useTypeImports: true,
        enumType: "string-literal",
      },
    },
  },
};

export default config;
