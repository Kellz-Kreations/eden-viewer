#!/bin/sh
set -eu

CERT_DIR="${CERT_DIR:-/tmp/certs}"
CERT_FILE="${CERT_FILE:-$CERT_DIR/localhost.crt}"
KEY_FILE="${KEY_FILE:-$CERT_DIR/localhost.key}"
DAYS="${CERT_DAYS:-30}"

PORT="${SETUP_UI_PORT:-3000}"

# Bring-your-own certificate support (recommended for trusted HTTPS on Synology):
# - Mount your cert/key into the container
# - Set SETUP_UI_CERT_FILE and SETUP_UI_KEY_FILE to those paths
CUSTOM_CERT_FILE="${SETUP_UI_CERT_FILE:-}"
CUSTOM_KEY_FILE="${SETUP_UI_KEY_FILE:-}"

mkdir -p "$CERT_DIR"

if [ -n "$CUSTOM_CERT_FILE" ] || [ -n "$CUSTOM_KEY_FILE" ]; then
  if [ -z "$CUSTOM_CERT_FILE" ] || [ -z "$CUSTOM_KEY_FILE" ]; then
    echo "Both SETUP_UI_CERT_FILE and SETUP_UI_KEY_FILE must be set." >&2
    exit 1
  fi
  if [ ! -s "$CUSTOM_CERT_FILE" ] || [ ! -s "$CUSTOM_KEY_FILE" ]; then
    echo "Custom TLS cert/key specified but not found or empty." >&2
    exit 1
  fi
else
  # Self-signed fallback (LAN/VPN only). Useful on Synology when you want HTTPS
  # but don't yet have a trusted certificate.
  if [ ! -s "$CERT_FILE" ] || [ ! -s "$KEY_FILE" ]; then
    OPENSSL_CNF="$CERT_DIR/openssl.cnf"
    cat > "$OPENSSL_CNF" <<'EOF'
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = localhost

[v3_req]
subjectAltName = @alt_names
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

    openssl req -x509 -nodes -newkey rsa:2048 \
      -days "$DAYS" \
      -keyout "$KEY_FILE" \
      -out "$CERT_FILE" \
      -config "$OPENSSL_CNF" \
      >/dev/null 2>&1
  fi

  export SETUP_UI_CERT_FILE="$CERT_FILE"
  export SETUP_UI_KEY_FILE="$KEY_FILE"
fi

export SETUP_UI_PORT="$PORT"

exec node server.js
