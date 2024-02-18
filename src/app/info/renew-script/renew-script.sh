#!/bin/sh

# WARNING: Do not run this as root!
# If $SESSION_TOKEN_CACHE is a symlink, its target wil be overwritten.

DEVICE_NAME='{{device.name}}'
DEVICE_HOST='{{device.host}}'
DEVICE_PORT='{{device.port}}'
DEVICE_USERNAME='{{device.username}}'
DEVICE_PASSPHRASE='{{device.passphrase}}'

umask 077

if ! TEMP_KEY_DIR="$(mktemp -d)"; then
    echo "Failed to create random temporary directory for key; using fallback" >&2
    TEMP_KEY_DIR="/tmp/renew-script.$$"
    if ! mkdir "${TEMP_KEY_DIR}"; then
        echo "Fallback temporary directory ${TEMP_KEY_DIR} already exists" >&2
        exit 1
    fi
fi

PRIV_KEY_FILE="${TEMP_KEY_DIR}/webos_privkey_${DEVICE_NAME}"

cat >"${PRIV_KEY_FILE}" <<END_OF_PRIVKEY
{{keyContent}}
END_OF_PRIVKEY

if [ -n "${DEVICE_PASSPHRASE}" ]; then
  ssh-keygen -p -P "${DEVICE_PASSPHRASE}" -N '' -f "${PRIV_KEY_FILE}"
fi

SESSION_TOKEN=$(ssh -i "${PRIV_KEY_FILE}" \
  -o ConnectTimeout=3 -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=+ssh-rsa \
  -o PubkeyAcceptedKeyTypes=+ssh-rsa \
  -p "${DEVICE_PORT}" "${DEVICE_USERNAME}@${DEVICE_HOST}" \
  cat /var/luna/preferences/devmode_enabled)

rm -rf "${TEMP_KEY_DIR}"

SESSION_TOKEN_CACHE="/tmp/webos_devmode_token_${DEVICE_NAME}.txt"

if [ -z "$SESSION_TOKEN" ]; then
  echo "ssh into TV failed, loading previous SESSION_TOKEN from ${SESSION_TOKEN_CACHE}" >&2
  SESSION_TOKEN=$(cat "${SESSION_TOKEN_CACHE}")
else
  echo "Got SESSION_TOKEN from TV - writing to ${SESSION_TOKEN_CACHE}" >&2
  echo "$SESSION_TOKEN" >"${SESSION_TOKEN_CACHE}"
fi

if [ -z "$SESSION_TOKEN" ]; then
  echo "Unable to get token" >&2
  exit 1
fi

CHECK_RESULT=$(curl --max-time 3 -s "https://developer.lge.com/secure/ResetDevModeSession.dev?sessionToken=$SESSION_TOKEN")

echo "${CHECK_RESULT}"
