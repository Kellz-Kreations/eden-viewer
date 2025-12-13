---
description: Instructions for setting up TLS/HTTPS for the Synology DS923+ and Azure remote deployments of the Eden Viewer media stack.
applyTo: "**"
---

# Copilot Instructions

## TLS Overview
- Focus on the Synology DS923+ home media stack (Plex, Sonarr, Radarr) and the optional Azure remote deployment that mirrors the same Docker Compose services.
- Prioritize LAN-only access for Synology; require VPN or authenticated reverse proxy + TLS before exposing *arr services externally.
- Document certificate handling for both Azure-managed endpoints and bring-your-own (BYO) certificates so contributors can maintain consistent HTTPS guidance.

## Setup UI
- The Setup UI provides a web-based OOBE (Out-of-Box Experience) wizard at `http://localhost:8080`.
- Reference the Setup UI for first-run configuration of PUID/PGID/TZ, storage paths, and service selection.
- The `/api/plex-status` endpoint checks Plex connectivity using fallback candidates: domain (HTTPS/HTTP) → LAN host → Docker internal → localhost.
- Support TLS for Setup UI via `SETUP_UI_CERT_FILE` and `SETUP_UI_KEY_FILE` environment variables.
- Force OOBE mode with `SETUP_UI_FIRST_RUN=true` for testing.
- Default port is 8080; auto-fallback to random port if busy.

## Synology DS923+
- Assume DSM 7.x with Docker (Container Manager) and Btrfs volumes under `/volume1`.
- Recommend VPN-first access (Tailscale, Synology VPN Server, WireGuard) instead of public exposure.
- If TLS is desired on Synology, describe reverse proxy patterns (e.g., DSM Application Portal, Caddy, Nginx) that terminate HTTPS locally while upstream containers stay on HTTP.
- Remind users of DS923+ hardware limits (Ryzen R1600, no Quick Sync) and keep TLS references mindful of CPU impact.
- Emphasize backups (`/volume1/docker/appdata`, media libraries) before any certificate or reverse proxy changes.

## Azure Remote Stack
- Azure Container Apps deploy Plex, Sonarr, and Radarr with HTTPS endpoints (`https://<service>.<region>.azurecontainerapps.io`).
- Outline certificate options: Azure-managed certs for custom domains, Azure DNS + Key Vault certificates, or manual PEM uploads.
- Mention that storage accounts already enforce HTTPS (`supportsHttpsTrafficOnly = true`, `minimumTlsVersion = TLS1_2`).
- Provide steps for binding custom domains, obtaining certificates, and renewing them (Key Vault automation or scheduled `az` CLI rotations).
- Reference `SETUP_UI_CERT_FILE` / `SETUP_UI_KEY_FILE` env vars for mounting certs into the setup UI container; note the self-signed fallback.

## Plex Ingress Policy
- Default Container Apps configuration sets `allowInsecure: true` to preserve compatibility with legacy Plex clients that prefer HTTP fallback.
- Document the trade-off: keeping HTTP simplifies discovery but leaves plaintext paths available; disabling (`allowInsecure: false`) enforces HTTPS-only access.
- Provide guidance: keep HTTP for lab/testing, but recommend turning it off in hardened environments once HTTPS + certificates are confirmed.

## Authoring Notes for Copilot
- When generating documentation or scripts, call out whether instructions target Synology LAN users or Azure remote deployments.
- Always reference `.env` variables for PUID/PGID/TZ and Synology path mappings (`/volume1/data`, `/volume1/docker/appdata`).
- Reinforce VPN + TLS requirements for Sonarr/Radarr when remote access is mentioned.
- Link to detailed steps in `azure/README.md`, `docs/synology-setup.md`, and setup UI docs after they are updated with TLS workflows.
- Use clear, concise language suitable for users with moderate technical skills familiar with Docker and Synology DSM.
- Encourage best practices around security, backups, and certificate management throughout the documentation.
- Test generated instructions against both Synology and Azure setups to ensure accuracy and completeness before finalizing.
- Avoid suggesting any properties other than `name`, `description`, and `applyTo` in the YAML front matter.
- Set `applyTo` to `**` to ensure the instructions apply to all files in the repository.
- Provide examples and code snippets where applicable to illustrate configuration steps.
- Highlight any potential pitfalls or common mistakes users might encounter during TLS setup and how to avoid them.

---

# TLS/HTTPS Setup for Eden Viewer Media Stack

This document outlines the steps to configure TLS/HTTPS for both Synology DS923+ local deployments and Azure remote deployments of the Eden Viewer media stack, which includes Plex, Sonarr, and Radarr.

## Table of Contents
1. [Synology DS923+ Setup](#synology-ds923-setup)
2. [Azure Remote Deployment Setup](#azure-remote-deployment-setup)
3. [Plex Ingress Policy](#plex-ingress-policy)
4. [Setup UI Quick Start](#setup-ui-quick-start)

## Synology DS923+ Setup

For Synology DS923+ users, we recommend using a reverse proxy to handle HTTPS termination. This allows Plex to continue listening on its default port (32400) for LAN clients while providing secure access over HTTPS.

### Steps to Configure HTTPS with Caddy Reverse Proxy

1. **Set Environment Variables**: In your `.env` file, set the following variables:

    ```env
    PLEX_DOMAIN=viewer.kellzkreations.com
    ```

2. **DNS Configuration**: Create an A record or CNAME pointing `viewer.kellzkreations.com` to your public IP or NAS hostname.

3. **Port Forwarding**: Ensure that ports 80 and 443 are forwarded to your NAS or are accessible via a VPN/reverse-proxy appliance that supports ACME HTTP-01 validation.

4. **Create Caddy Data Directory**: Ensure the directory `/volume1/docker/appdata/caddy` exists to store certificates persistently:

    ```bash
    mkdir -p /volume1/docker/appdata/caddy
    ```

5. **Deploy the Stack**: Use Docker Compose or Synology Container Manager to deploy the stack with the new `plex-proxy` service.

### Accessing Services Remotely

- Use `https://viewer.kellzkreations.com` for Plex access over HTTPS.
- For Sonarr and Radarr, we strongly recommend using a VPN (e.g., Tailscale, Synology VPN Server) for secure remote access.

## Azure Remote Deployment Setup

Azure Container Apps provide built-in HTTPS endpoints for your services. You can use Azure-managed certificates or bring your own certificates for custom domains.

### Configuring HTTPS in Azure

1. **Custom Domain Setup**: Bind your custom domain to the Azure Container App services.

2. **Certificate Options**:
   - Use Azure-managed certificates for automatic provisioning.
   - Use Azure Key Vault to manage your own certificates.
   - Manually upload PEM files if preferred.

3. **Mounting Certificates**: Use the `SETUP_UI_CERT_FILE` and `SETUP_UI_KEY_FILE` environment variables to mount your certificates into the setup UI container.

### Storage Account HTTPS Enforcement

Ensure that your Azure Storage Accounts enforce HTTPS by setting `supportsHttpsTrafficOnly = true` and `minimumTlsVersion = TLS1_2`.

## Plex Ingress Policy

By default, the Azure Container Apps configuration allows insecure HTTP traffic to maintain compatibility with legacy Plex clients. However, for enhanced security, you can disable this by setting `allowInsecure: false` in your ingress configuration. This will enforce HTTPS-only access to your Plex service.

### Recommendations

- For testing and lab environments, you may keep HTTP enabled.
- For production environments, especially when exposing services to the internet, it is recommended to disable HTTP access once HTTPS is confirmed to be working correctly.
- Always back up your configuration and data before making changes to TLS or reverse proxy settings.
- Refer to the detailed setup guides in `azure/README.md` and `docs/synology-setup.md` for more information on configuring your specific environment.
- Stay updated with best practices for security and certificate management to ensure a safe media streaming experience.

## Setup UI Quick Start

The Setup UI wizard guides first-time users through configuration:

```bash
cd setup-ui
npm install
npm start
# Access at http://localhost:8080
```

### Testing OOBE
```bash
# Force first-run experience
rm -f config/config.json
SETUP_UI_FIRST_RUN=true npm start
```

See [setup-ui/README.md](../setup-ui/README.md) for full API documentation.

Happy streaming!
— The Eden Viewer Team

