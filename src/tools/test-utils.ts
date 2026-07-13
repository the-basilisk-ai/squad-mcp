import type { DocumentNode, OperationDefinitionNode } from "graphql";
import type { vi } from "vitest";

/** Test-only helpers shared by tool tests (excluded from build output via tests). */

export type CapturedHandler = (
  params: unknown,
  ctx: unknown,
) => Promise<{ content: { text: string }[]; isError?: true }>;

export function captureTools(
  register: (server: never) => void,
): Map<string, CapturedHandler> {
  const tools = new Map<string, CapturedHandler>();
  register({
    tool: (def: { name: string }, handler: CapturedHandler) => {
      tools.set(def.name, handler);
    },
  } as never);
  return tools;
}

export function opName(doc: DocumentNode): string {
  const def = doc.definitions.find(
    (d): d is OperationDefinitionNode => d.kind === "OperationDefinition",
  );
  return def?.name?.value ?? "unknown";
}

export const authCtx = {
  auth: {
    accessToken: "at",
    payload: { sub: "user-1", scope: "read:workspace write:workspace" },
  },
};

export const userCtx = {
  orgId: "pa-org-1",
  workspaceId: "ws-1",
  orgSlug: "acme",
  workspaceSlug: "main",
  token: "svc-jwt",
};

export function parse(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

export function byOperation(
  mockExecute: ReturnType<typeof vi.fn>,
  responses: Record<string, unknown | ((vars: unknown) => unknown)>,
): void {
  mockExecute.mockImplementation((doc: DocumentNode, vars: unknown) => {
    const name = opName(doc);
    const response = responses[name];
    if (response === undefined) {
      return Promise.reject(new Error(`No mock for operation ${name}`));
    }
    return Promise.resolve(
      typeof response === "function" ? response(vars) : response,
    );
  });
}
