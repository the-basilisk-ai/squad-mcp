/**
 * Environment switching for the Squad platform.
 * v4 has two environments: dev and production (SQUAD_ENV, default production).
 */

export function getPropelAuthUrl(): string {
  const squadEnv = process.env.SQUAD_ENV || "production";
  if (squadEnv === "dev") {
    return "https://48820142.propelauthtest.com";
  }
  return "https://auth.meetsquad.ai";
}

export function getSquadApiUrl(): string {
  const squadEnv = process.env.SQUAD_ENV || "production";
  if (squadEnv === "dev") {
    return "https://dev.api.v2.meetsquad.ai";
  }
  return "https://api.meetsquad.ai";
}

/**
 * GraphQL endpoint of the Squad platform API.
 * SQUAD_GRAPHQL_URL overrides (also used by codegen introspection).
 */
export function getSquadGraphqlUrl(): string {
  return process.env.SQUAD_GRAPHQL_URL || `${getSquadApiUrl()}/graphql`;
}

export function getSquadAppUrl(): string {
  const squadEnv = process.env.SQUAD_ENV || "production";
  if (squadEnv === "dev") {
    return "https://dev.v2.meetsquad.ai";
  }
  return "https://app.meetsquad.ai";
}
