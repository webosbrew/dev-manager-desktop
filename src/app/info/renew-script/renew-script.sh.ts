// language=shell
export default `#!/bin/sh

# WARNING: Do not run this as root!
# This script contains the TV's SSH private key and passphrase. Store it securely.

DEVICE_NAME='{{device.name}}'
DEVICE_HOST='{{device.host}}'
DEVICE_PORT='{{device.port}}'
DEVICE_USERNAME='{{device.username}}'
DEVICE_PASSPHRASE='{{device.passphrase}}'

umask 077

if ! TEMP_KEY_DIR="$(mktemp -d)"; then
    echo "Failed to create random temporary directory for key; using fallback" >&2
    TEMP_KEY_DIR="/tmp/renew-script.$$"
    if ! mkdir "\${TEMP_KEY_DIR}"; then
        echo "Fallback temporary directory \${TEMP_KEY_DIR} already exists" >&2
        exit 1
    fi
fi

cleanup() {
  rm -rf "\${TEMP_KEY_DIR}"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

PRIV_KEY_FILE="\${TEMP_KEY_DIR}/webos_privkey_\${DEVICE_NAME}"

cat >"\${PRIV_KEY_FILE}" <<END_OF_PRIVKEY
{{keyContent}}
END_OF_PRIVKEY

if [ -n "\${DEVICE_PASSPHRASE}" ] &&
  ! ssh-keygen -p -P "\${DEVICE_PASSPHRASE}" -N '' -f "\${PRIV_KEY_FILE}" >/dev/null; then
  echo "Failed to unlock the SSH private key" >&2
  exit 1
fi

RENEW_PAYLOAD='{"id":"com.palmdts.devmode","subscribe":false,"params":{"extend":true}}'

if ! RENEW_RESULT=$(ssh -i "\${PRIV_KEY_FILE}" \\
  -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no \\
  -o HostKeyAlgorithms=+ssh-rsa \\
  -o PubkeyAcceptedKeyTypes=+ssh-rsa \\
  -p "\${DEVICE_PORT}" "\${DEVICE_USERNAME}@\${DEVICE_HOST}" \\
  "luna-send-pub -n 1 luna://com.webos.applicationManager/launch '\${RENEW_PAYLOAD}'"); then
  echo "Failed to connect to the TV or start Developer Mode renewal" >&2
  exit 1
fi

if ! printf '%s\\n' "\${RENEW_RESULT}" |
  grep -Eq '"returnValue"[[:space:]]*:[[:space:]]*true'; then
  echo "TV rejected the renewal request: \${RENEW_RESULT}" >&2
  exit 1
fi

printf '%s\\n' "\${RENEW_RESULT}"`;
