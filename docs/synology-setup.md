# Synology Setup Notes (DSM 7.x)

## Container Manager
- Use Container Manager Projects with Compose files for repeatability.

## Networking
- Plex uses `network_mode: host` for simpler discovery.
- Sonarr/Radarr use a bridge network and publish ports to LAN.

If you need remote access to Sonarr/Radarr, prefer VPN; otherwise put strong auth + TLS in front of any reverse proxy.

## TLS & Remote Access

- **Default stance:** keep Plex, Sonarr, and Radarr on the LAN behind your home router. Require VPN or zero-trust tunnels (Tailscale, Synology VPN Server, WireGuard) before exposing management ports.
- **Reverse proxy option:** if you must terminate HTTPS on the NAS, use DSM Application Portal, Caddy, or Nginx to handle TLS locally while containers remain on HTTP. Map certificates from `/volume1/docker/appdata/<proxy>/certs` and redirect all plain HTTP to HTTPS.
- **Certificates:** back up `/volume1/docker/appdata` before introducing new certs. Use Let’s Encrypt DNS-01 (via Synology’s built-in ACME client or Caddy) or import BYO PEM bundles; renewals may increase CPU usage on the Ryzen R1600, so schedule them during off-peak hours.
- **VPN first for *arr:** even with HTTPS, Sonarr and Radarr contain API keys and download clients. Encourage users to connect through VPN/Tailscale; if you expose them, enforce strong auth (OIDC, Authentik, Authelia) plus certificates.
- **Monitoring:** after TLS changes, test endpoints from a LAN client (`curl -I https://nas.local:443`) and confirm DSM reverse proxy rules didn’t break container health.

## Storage

- Keep a single data root (e.g. `/volume1/data`) and mount it as `/data` in *arr containers.
- Keep app configs in `/volume1/docker/appdata/<app>`.

## Performance

- Consider SSD/NVMe for Plex metadata if your DSM/storage setup supports it.
- Allocate a dedicated transcode folder with enough free space.
