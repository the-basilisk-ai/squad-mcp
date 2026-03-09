import { getPropelAuthUrl } from "./config.js";

const AUTH_URL = getPropelAuthUrl();

type IntrospectionResult = {
  active: boolean;
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
  scope?: string;
  client_id?: string;
  token_type?: string;
};

function isValidIntrospectionResult(
  data: unknown,
): data is IntrospectionResult {
  if (typeof data !== "object" || data === null) return false;
  return typeof (data as Record<string, unknown>).active === "boolean";
}

function getIntrospectionCredentials(): string {
  const clientId = process.env.PROPELAUTH_CLIENT_ID ?? "";
  const clientSecret = process.env.PROPELAUTH_CLIENT_SECRET ?? "";
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function introspectToken(
  token: string,
): Promise<IntrospectionResult> {
  const response = await fetch(`${AUTH_URL}/oauth/2.1/introspect`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getIntrospectionCredentials()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }),
  });

  if (!response.ok) {
    throw new Error(
      `Introspection failed: ${response.status} ${response.statusText}`,
    );
  }

  const data: unknown = await response.json();

  if (!isValidIntrospectionResult(data)) {
    throw new Error(
      'Invalid introspection response: missing or invalid "active" field',
    );
  }

  return data;
}
