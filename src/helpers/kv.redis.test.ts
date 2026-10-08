// Runs the app's Redis calls as a user holding only src/helpers/redis-acl.txt,
// the rules the Railway `mcp` user gets. Needs a real Redis: set REDIS_ADMIN_URL.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "redis";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  clearWorkspaceSelection,
  getWorkspaceSelection,
  setWorkspaceSelection,
} from "./getUser.js";
import { initKv } from "./kv.js";

const ADMIN_URL = process.env.REDIS_ADMIN_URL;
const USER = `mcp-acl-test-${randomUUID()}`;
const PASSWORD = "mcp-acl-test-password";

const rules = readFileSync(new URL("./redis-acl.txt", import.meta.url), "utf8")
  .split("\n")
  .filter(line => !/^\s*(#|$)/.test(line));

describe.skipIf(!ADMIN_URL)("Redis under the mcp ACL", () => {
  const admin = createClient({ url: ADMIN_URL });

  beforeAll(async () => {
    await admin.connect();
    await admin.sendCommand([
      "ACL",
      "SETUSER",
      USER,
      "reset",
      "on",
      `>${PASSWORD}`,
      ...rules,
    ]);
    const url = new URL(ADMIN_URL as string);
    url.username = USER;
    url.password = PASSWORD;
    await initKv(url.toString());
  });

  afterEach(async () => {
    const log = (await admin.sendCommand(["ACL", "LOG", "128"])) as unknown[][];
    expect(log.filter(entry => entry.includes(USER))).toEqual([]);
  });

  afterAll(async () => {
    await admin.sendCommand(["ACL", "DELUSER", USER]);
    await admin.close();
  });

  it("stores, reads and clears a workspace selection", async () => {
    const userId = `acl-test-${randomUUID()}`;
    const selection = {
      orgId: "o1",
      workspaceId: "w1",
      orgSlug: "acme",
      workspaceSlug: "default",
    };

    await setWorkspaceSelection(userId, selection);
    expect(await getWorkspaceSelection(userId)).toEqual(selection);
    await clearWorkspaceSelection(userId);
    expect(await getWorkspaceSelection(userId)).toBeUndefined();
  });

  it.each([
    ["GET", "other:key"],
    ["FLUSHALL"],
    ["KEYS", "*"],
    ["CONFIG", "SET", "dir", "/tmp"],
    ["REPLICAOF", "example.com", "6379"],
    ["ACL", "LIST"],
    ["SUBSCRIBE", "mcp:channel"],
  ])("denies %s", async (...command) => {
    expect(
      await admin.sendCommand(["ACL", "DRYRUN", USER, ...command]),
    ).toMatch(/no permissions/);
  });
});
