// language=shell
export default `#!/bin/sh

# Requires curl, jq, and OpenSSH (ssh and ssh-keygen).
# Install jq with your system package manager before scheduling this script.
# WARNING: Do not run this as root!
# If $SESSION_TOKEN_CACHE is a symlink, its target will be overwritten.

if ! command -v jq >/dev/null 2>&1; then
    echo "jq is required to validate renewal responses; install jq with your system package manager." >&2
    exit 1
fi

DEVICE_NAME='{{device.name}}'
DEVICE_HOST='{{device.host}}'
DEVICE_PORT='{{device.port}}'
DEVICE_USERNAME='{{device.username}}'
DEVICE_PASSPHRASE='{{device.passphrase}}'

umask 077
LC_ALL=C
export LC_ALL

valid_token() {
    case "$1" in
        ''|*[!0-9a-zA-Z]*) return 1 ;;
        *) return 0 ;;
    esac
}

if ! TEMP_KEY_DIR="$(mktemp -d)"; then
    echo "Failed to create random temporary directory for key; using fallback" >&2
    TEMP_KEY_DIR="/tmp/renew-script.$$"
    if ! mkdir "\${TEMP_KEY_DIR}"; then
        echo "Fallback temporary directory already exists; refusing to use it" >&2
        exit 1
    fi
fi
trap 'rm -rf "\${TEMP_KEY_DIR}"' 0
trap 'exit 1' HUP INT TERM

PRIV_KEY_FILE="\${TEMP_KEY_DIR}/webos_privkey_\${DEVICE_NAME}"

if ! cat >"\${PRIV_KEY_FILE}" <<END_OF_PRIVKEY
{{keyContent}}
END_OF_PRIVKEY
then
    echo "Unable to write temporary SSH private key" >&2
    exit 1
fi

if [ -n "\${DEVICE_PASSPHRASE}" ]; then
    if ! ssh-keygen -p -P "\${DEVICE_PASSPHRASE}" -N '' -f "\${PRIV_KEY_FILE}" >/dev/null 2>&1; then
        echo "Unable to decrypt SSH private key; check the saved key passphrase and generate the script again" >&2
        exit 1
    fi
fi

SESSION_TOKEN=""
if TV_TOKEN=$(ssh -n -i "\${PRIV_KEY_FILE}" \\
  -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no \\
  -o HostKeyAlgorithms=+ssh-rsa \\
  -o PubkeyAcceptedKeyTypes=+ssh-rsa \\
  -p "\${DEVICE_PORT}" "\${DEVICE_USERNAME}@\${DEVICE_HOST}" \\
  cat /var/luna/preferences/devmode_enabled); then
    if valid_token "$TV_TOKEN"; then
        SESSION_TOKEN="$TV_TOKEN"
    else
        echo "TV returned an invalid session token; trying the persistent cache" >&2
    fi
else
    echo "Unable to read session token over SSH; trying the persistent cache" >&2
fi

# Keep the token across reboots so renewal also works while the TV is off.
# XDG_STATE_HOME must be absolute; otherwise use the current user's home.
case "$XDG_STATE_HOME" in
  /*) STATE_HOME="$XDG_STATE_HOME" ;;
  *) STATE_HOME="\${HOME:+\${HOME}/.local/state}" ;;
esac
SESSION_TOKEN_CACHE=""
if [ -n "$STATE_HOME" ]; then
  SESSION_TOKEN_CACHE="$STATE_HOME/webos-dev-manager/webos_devmode_token_\${DEVICE_NAME}.txt"
fi

if [ -z "$SESSION_TOKEN" ]; then
    if [ -n "$SESSION_TOKEN_CACHE" ] && [ -r "$SESSION_TOKEN_CACHE" ]; then
        if CACHED_TOKEN=$(cat "$SESSION_TOKEN_CACHE") && valid_token "$CACHED_TOKEN"; then
            SESSION_TOKEN="$CACHED_TOKEN"
        else
            echo "Persistent session-token cache is unreadable or invalid; ignoring it" >&2
        fi
    fi
else
    if [ -n "$SESSION_TOKEN_CACHE" ] && mkdir -p "$STATE_HOME/webos-dev-manager"; then
        if ! printf '%s\\n' "$SESSION_TOKEN" >"$SESSION_TOKEN_CACHE"; then
            echo "Unable to save token cache; continuing with token from TV" >&2
        fi
    else
        echo "Unable to create token cache directory; continuing with token from TV" >&2
    fi
fi

if [ -z "$SESSION_TOKEN" ]; then
    echo "Unable to get token from TV or persistent cache; turn on the TV and try again" >&2
    exit 1
fi

if CHECK_RESULT=$(curl --max-time 3 --fail --silent --show-error "https://developer.lge.com/secure/ResetDevModeSession.dev?sessionToken=$SESSION_TOKEN"); then
    if ! printf '%s' "$CHECK_RESULT" | jq -e -s 'length == 1 and (.[0] | type == "object" and .result == "success")' >/dev/null 2>&1; then
        echo "Renewal server returned an invalid or unsuccessful JSON response" >&2
        exit 1
    fi
else
    CURL_STATUS=$?
    echo "Renewal request failed (curl exit $CURL_STATUS)" >&2
    exit "$CURL_STATUS"
fi

printf '%s\\n' '{"result":"success"}'`;
