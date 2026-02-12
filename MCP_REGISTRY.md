# MCP Registry Publishing

This server is listed on the [MCP Registry](https://registry.modelcontextprotocol.io) as `ai.meetsquad/squad`.

## server.json

The `server.json` file contains metadata published to the registry. It is not used at runtime.

## Publishing manually

1. Install the CLI: `brew install mcp-publisher`
2. Retrieve the signing key from 1Password: `op document get "MCP Registry - meetsquad.ai signing key" --out-file key.pem`
3. Authenticate:
    ```bash
    PRIVATE_KEY="$(openssl pkey -in key.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
    mcp-publisher login dns --domain "meetsquad.ai" --private-key "${PRIVATE_KEY}"
    rm key.pem
    ```
4. Update the version in `server.json`
5. Publish: `mcp-publisher publish`
