import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers.js";

function buildApp() {
  const app = new Hono();
  app.use("*", securityHeaders);

  app.get("/json", c => c.json({ ok: true }));

  // The MCP transport returns its own streamed Response rather than using the
  // Hono context helpers, so this is the case the middleware has to survive.
  app.get(
    "/stream",
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("data: hello\n\n"));
            controller.close();
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  );

  return app;
}

describe("securityHeaders", () => {
  it.each([
    ["a JSON response", "/json", 200],
    ["a streamed response", "/stream", 200],
    ["a 404", "/nowhere", 404],
  ])("sets both headers on %s", async (_label, path, status) => {
    const res = await buildApp().request(path);

    expect(res.status).toBe(status);
    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=31536000",
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("leaves the streamed content-type and body intact", async () => {
    const res = await buildApp().request("/stream");

    expect(res.headers.get("content-type")).toBe("text/event-stream");
    await expect(res.text()).resolves.toBe("data: hello\n\n");
  });
});
