/**
 * Get PropelAuth URL based on SQUAD_ENV
 */
export function getPropelAuthUrl(): string {
  const squadEnv = process.env.SQUAD_ENV || "production";

  if (squadEnv === "dev") {
    return "https://26904088430.propelauthtest.com";
  }
  if (squadEnv === "staging") {
    return "https://auth.app.meetsquad.ai";
  }
  return "https://auth.meetsquad.ai"; // production
}

/**
 * Get Squad API URL based on SQUAD_ENV
 */
export function getSquadApiUrl(): string {
  const squadEnv = process.env.SQUAD_ENV || "production";

  if (squadEnv === "dev") {
    return "https://dev.api.meetsquad.ai";
  }
  if (squadEnv === "staging") {
    return "https://uat.api.meetsquad.ai";
  }
  return "https://api.meetsquad.ai";
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
