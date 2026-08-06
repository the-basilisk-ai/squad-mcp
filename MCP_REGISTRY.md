# MCP Registry Publishing

This server is listed on the [MCP Registry](https://registry.modelcontextprotocol.io) as `ai.meetsquad/squad`.

## server.json

The `server.json` file contains metadata published to the registry. It is not used at runtime.

## Publishing

Publishing is automatic. Merging a release-please PR tags a release, and
`.github/workflows/publish-registry.yml` publishes `server.json` to the registry
from that tag. `server.json`'s version is bumped by release-please alongside
`package.json`, so it always matches the release — never edit it by hand.

Auth uses the `MCP_REGISTRY_PRIVATE_KEY` repo secret: the raw 32-byte Ed25519
seed of the meetsquad.ai signing key, hex-encoded. To (re)set it from 1Password:

```bash
op item get "MCP Registry - meetsquad.ai signing key" \
  --fields private_key --format json --reveal | jq -r .value \
  | openssl pkey -outform DER | tail -c 32 | xxd -p -c 64 \
  | gh secret set MCP_REGISTRY_PRIVATE_KEY -R the-basilisk-ai/squad-mcp
```

## Publishing manually

Only needed if the workflow is broken:

```bash
mcp-publisher() { go run github.com/modelcontextprotocol/registry/cmd/publisher@v1.8.0 "$@"; }

PRIVATE_KEY="$(op item get "MCP Registry - meetsquad.ai signing key" \
  --fields private_key --format json --reveal | jq -r .value \
  | openssl pkey -outform DER | tail -c 32 | xxd -p -c 64)"
mcp-publisher login dns --domain "meetsquad.ai" --private-key "${PRIVATE_KEY}"

mcp-publisher validate && mcp-publisher publish
```

Needs Go and jq, or `brew install mcp-publisher`. Run `mcp-publisher logout` when you're done.
