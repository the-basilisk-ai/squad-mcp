# MCP Registry Publishing

This server is listed on the [MCP Registry](https://registry.modelcontextprotocol.io) as `ai.meetsquad/squad`.

## server.json

The `server.json` file contains metadata published to the registry. It is not used at runtime.

## Publishing manually

1. Bump the version in `server.json` — the registry rejects duplicate versions
2. Paste this:

    ```bash
    mcp-publisher() { go run github.com/modelcontextprotocol/registry/cmd/publisher@v1.8.0 "$@"; }

    PRIVATE_KEY="$(op item get "MCP Registry - meetsquad.ai signing key" \
      --fields private_key --format json --reveal | jq -r .value \
      | openssl pkey -outform DER | tail -c 32 | xxd -p -c 64)"
    mcp-publisher login dns --domain "meetsquad.ai" --private-key "${PRIVATE_KEY}"

    mcp-publisher validate && mcp-publisher publish
    ```

Needs Go and jq, or `brew install mcp-publisher`. Run `mcp-publisher logout` when you're done.
