# Redis access control

The server connects to Redis as `mcp`, a user that can read and write `mcp:*` keys
with the five commands the server sends, and nothing else. The built-in `default`
user keeps full rights for break-glass administration and is not given to the server.
Same setup in Railway `dev` and `production`. Same model as `squidge`, whose
`docs/security/redis-access.md` has the longer rationale.

## What Redis holds

One consumer, `src/helpers/kv.ts`, using GET, SET with an expiry, and DEL.

| Key | Holds | Lifetime |
| --- | --- | --- |
| `mcp:jwt:{userId}:{orgId}` | minted Squad API access token | 55 min |
| `mcp:selection:{userId}` | the user's selected org and workspace | 30 days |

The cached tokens are bearer credentials for the Squad API, which is the main reason
the connection is restricted. Redis snapshots to its Railway volume (`--save 60 1`),
so they sit on disk until they expire. Redis is on private networking only, with no
TCP proxy and no public domain.

## The `mcp` user

[`src/helpers/redis-acl.txt`](../../src/helpers/redis-acl.txt) defines it: `-@all`,
then GET, SET and DEL for the store, PING for the 30 second keepalive, and
`CLIENT SETINFO`, which node-redis sends on connect. Keys are limited to `mcp:*` and
pubsub channels to none. The rules are listed in the order `ACL LIST` prints them, so
the deployed user can be compared with the file exactly.

With `default`, a leaked `REDIS_URL` allows `FLUSHALL`, `KEYS *` (every cached token),
`CONFIG SET dir` (arbitrary file write) and `REPLICAOF` (copying the data out). With
`mcp` it allows none of them, and a key outside `mcp:` is refused.

`default` stays as the admin account. Access to it is Railway project membership, and
admin sessions go through `railway ssh`.

## How it is wired on Railway

The Redis service runs the stock `redis` image with Railway's template start command
plus a `--user mcp ...` argument. There is no ACL file, so runtime `ACL SETUSER`
changes are lost on restart and the start command is the only definition. Railway
keeps patching the image automatically.

| Service | Variable | Value |
| --- | --- | --- |
| Redis | `REDIS_PASSWORD` | admin password for `default`, sealed |
| Redis | `REDIS_MCP_PASSWORD` | `mcp` password, sealed, from `openssl rand -hex 32` |
| Redis | `REDIS_MCP_URL` | `redis://mcp:${{REDIS_MCP_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:6379` |
| squad-mcp | `REDIS_URL` | `${{<redis service>.REDIS_MCP_URL}}` |

Passwords live in the 1Password Environment for that Railway environment and are added
there first. `REDIS_MCP_PASSWORD` must be hex, because the start command expands it
unquoted.

## Applying and verifying

1. Record the Redis service's current start command and `ACL LIST`.
2. Paste the output of `pnpm redis:start-command` into the Redis service's custom start
   command and deploy. Redis restarts in a few seconds.
3. `pnpm redis:verify <env> <redis service>` (needs `railway link`) passes only when the
   deployed rules equal the file and `REDIS_MCP_URL` logs in. Save its output.
4. Set the server's `REDIS_URL` to the Redis service's `REDIS_MCP_URL` and deploy.
5. In the Redis container, `CLIENT LIST` shows `user=mcp` for the server's connection
   and `ACL LOG` is empty.
6. Rotate `REDIS_PASSWORD`, which the server held until step 4: update 1Password, set
   the new value, redeploy Redis, then seal it in the dashboard.

`src/helpers/kv.redis.test.ts` runs in CI against a Redis service. It creates a user
from the rules file, runs the workspace selection flow through `kv.ts`, fails on any
`ACL LOG` entry, and checks with `ACL DRYRUN` that admin commands and non-`mcp:` keys
are refused. New Redis commands or key prefixes need a rules change in the same PR.

**Rollback:** set the server's `REDIS_URL` back to the Redis service's `REDIS_URL`
(the `default` user) and redeploy. Restore the recorded start command only after that.
