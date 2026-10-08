#!/usr/bin/env bash
# Railway Redis `mcp` user, defined by src/helpers/redis-acl.txt.
#   redis-acl.sh start-command        print the Redis service start command
#   redis-acl.sh verify <env> <svc>   assert the deployed user matches the file
#                                     and REDIS_MCP_URL logs in (needs `railway link`)
set -euo pipefail

rules() { grep -Ev '^[[:space:]]*(#|$)' "$(dirname "$0")/../src/helpers/redis-acl.txt"; }

case "${1:-}" in
start-command)
    # Railway hands this to `sh -c`, which would read the > and * in the rules as shell syntax.
    quoted=$(rules | sed "s/.*/'&'/" | paste -sd' ' -)
    echo "/bin/sh -c \"rm -rf \$RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass \$REDIS_PASSWORD --save 60 1 --dir \$RAILWAY_VOLUME_MOUNT_PATH --user mcp on '>'\$REDIS_MCP_PASSWORD $quoted\""
    ;;
verify)
    env="${2:?usage: redis-acl.sh verify <env> <redis service>}"
    svc="${3:?usage: redis-acl.sh verify <env> <redis service>}"
    want=$(rules | paste -sd' ' -)
    # railway ssh allocates a tty, so force raw redis-cli output and strip CRs.
    # shellcheck disable=SC2016 # expanded inside the Redis container
    got=$( (railway ssh --environment "$env" --service "$svc" \
        'redis-cli -e --no-auth-warning -u "$REDIS_MCP_URL" GET mcp:verify >/dev/null && REDISCLI_AUTH=$REDIS_PASSWORD redis-cli --raw --no-auth-warning ACL LIST' || true) \
        | tr -d '\r' | sed -nE 's/^user mcp on .*#[0-9a-f]{64} //p')
    if [ "$got" != "$want" ]; then
        printf 'Railway %s mcp user does not match src/helpers/redis-acl.txt\n  want: %s\n  got:  %s\n' "$env" "$want" "${got:-<missing, off, or login failed>}" >&2
        exit 1
    fi
    echo "Railway $env mcp user matches src/helpers/redis-acl.txt and its password works."
    ;;
*)
    echo "usage: redis-acl.sh start-command | verify <env> <redis service>" >&2
    exit 2
    ;;
esac
