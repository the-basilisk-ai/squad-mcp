import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceOverviewDocument } from "../gql/graphql.js";
import { execute, SquadApiError } from "./squad-api-client.js";

const ctx = { token: "svc-token", workspaceId: "ws-1" };
const variables = { workspaceId: "ws-1", days: 7 };

describe("execute", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends auth and workspace headers with the printed query", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { workspaces: [] } }), {
        status: 200,
      }),
    );

    await execute(WorkspaceOverviewDocument, variables, ctx);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/graphql");
    expect(init.headers.authorization).toBe("Bearer svc-token");
    expect(init.headers["x-workspace-id"]).toBe("ws-1");
    const body = JSON.parse(init.body);
    expect(body.query).toContain("query WorkspaceOverview");
    expect(body.variables).toEqual(variables);
  });

  it("maps HTTP 402 to the credits message", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 402 }));

    await expect(
      execute(WorkspaceOverviewDocument, variables, ctx),
    ).rejects.toThrow(/run out of AI credits/);
  });

  it("maps HTTP 401 to the reconnect message", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));

    await expect(
      execute(WorkspaceOverviewDocument, variables, ctx),
    ).rejects.toThrow(/try reconnecting/);
  });

  it("throws GraphQL error messages, not raw JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ message: "Workspace not found" }, { message: "Denied" }],
        }),
        { status: 200 },
      ),
    );

    const error = await execute(WorkspaceOverviewDocument, variables, ctx)
      .then(() => {
        throw new Error("expected execute to reject");
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SquadApiError);
    expect((error as SquadApiError).message).toBe(
      "Workspace not found; Denied",
    );
  });
});
