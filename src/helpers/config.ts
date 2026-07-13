/**
 * Get PropelAuth URL based on SQUAD_ENV
 */
export function getPropelAuthUrl(): string {
  const squadEnv = process.env.SQUAD_ENV || "production";

  if (squadEnv === "dev") {
    return "https://26904088430.propelauthtest.com";
  }
  if (squadEnv === "staging") {
    return "https://auth.uat.v1.meetsquad.ai";
  }
  return "https://auth.v1.meetsquad.ai"; // production
}

/**
 * Get Squad API URL based on SQUAD_ENV
 */
export function getSquadApiUrl(): string {
  const squadEnv = process.env.SQUAD_ENV || "production";

  if (squadEnv === "dev") {
    return "https://dev.api.v1.meetsquad.ai";
  }
  if (squadEnv === "staging") {
    return "https://uat.api.v1.meetsquad.ai";
  }
  return "https://api.v1.meetsquad.ai";
}

/**
 * Get Squad App URL based on SQUAD_ENV
 */
export function getSquadAppUrl(): string {
  const squadEnv = process.env.SQUAD_ENV || "production";

  if (squadEnv === "dev") {
    return "https://dev.meetsquad.ai";
  }
  if (squadEnv === "staging") {
    return "https://uat.meetsquad.ai";
  }
  return "https://app.meetsquad.ai";
}
