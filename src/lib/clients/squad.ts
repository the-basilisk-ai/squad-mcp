import * as SquadApi from "../openapi/squad/index.js";
import { withAuth } from "./middleware/with-auth.js";
import type { UserContext } from "../../helpers/getUser.js";

const getEnv = (): "production" | "staging" | "development" => {
  if (!process.env.SQUAD_ENV) {
    return "production";
  }
  if (process.env.SQUAD_ENV === "dev") {
    return "development";
  }
  if (process.env.SQUAD_ENV === "staging") {
    return "staging";
  }
  return "production";
};

const getBasePath = (): string => {
  const env = getEnv();
  if (env === "production") {
    return "https://api.meetsquad.ai";
  }
  if (env === "staging") {
    return "https://uat.api.meetsquad.ai";
  }
  return "https://dev.api.meetsquad.ai";
};

/**
 * Create a Squad API client with OAuth token authentication
 * @param auth - UserContext or object with token
 */
export function squadClient(
  auth: UserContext | { token: string }
): SquadApi.SquadApi {
  const { token } = auth;

  if (!token) {
    throw new Error("Token is required");
  }

  const basePath = getBasePath();

  return new SquadApi.SquadApi(
    new SquadApi.Configuration({
      basePath,
      middleware: [withAuth(token)],
    }),
  );
}
