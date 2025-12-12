#!/bin/sh
set -eu

CERT_DIR="${CERT_DIR:-/tmp/certs}"
CERT_FILE="${CERT_FILE:-$CERT_DIR/localhost.crt}"
KEY_FILE="${KEY_FILE:-$CERT_DIR/localhost.key}"
DAYS="${CERT_DAYS:-30}"

mkdir -p "$CERT_DIR"

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

exec gunicorn \
  -b 0.0.0.0:8080 \
  --workers 2 \
  --threads 4 \
  --timeout 30 \
  --certfile "$CERT_FILE" \
  --keyfile "$KEY_FILE" \
  app:app
