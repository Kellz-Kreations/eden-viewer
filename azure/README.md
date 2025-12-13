# Eden Viewer – Azure VM Deployment Guide

> ⚠️ The Synology DS923+ stack remains the recommended deployment. Use this Azure VM guide only when you need a temporary remote instance running the same Plex/Sonarr/Radarr Docker Compose stack.

## Cost Snapshot (Central US)

| Item | Example SKU | Est. Monthly Cost* |
|------|-------------|--------------------|
| VM | Standard_D2s_v3 | $70 |
| 128 GB Premium SSD | P15 | $24 |
| 1 TB Standard HDD (data) | E10 | $45 |
| Public IP/DNS | Standard | $3 |
| **Approx. total** | | **~$140/month + egress** |

_*Pricing varies; use Azure Calculator for exact numbers._

## 1. Provision Azure Resources

```powershell
az group create --name rg-eden-viewer --location centralus

az vm create `
  --resource-group rg-eden-viewer `
  --name eden-viewer-vm `
  --location centralus `
  --image Ubuntu2204 `
  --size Standard_D2s_v3 `
  --os-disk-size-gb 128 `
  --public-ip-sku Standard `
  --admin-username azureuser `
  --generate-ssh-keys
```

Keep the output handy (public IP, NIC, NSG names).

## 2. Lock Down Networking

| Port | Use | Recommendation |
|------|-----|----------------|
| 22/TCP | SSH | Restrict to your IP (NSG rule) |
| 32400/TCP | Plex | Optional internet exposure |
| 7878/TCP | Radarr | **VPN-only** (do not expose) |
| 8989/TCP | Sonarr | **VPN-only** (do not expose) |

```powershell
# Allow Plex from anywhere
az vm open-port --resource-group rg-eden-viewer --name eden-viewer-vm --port 32400 --priority 100

# Allow SSH from a single IP
az network nsg rule create `
  --resource-group rg-eden-viewer `
  --nsg-name eden-viewer-vmNSG `
  --name Allow-SSH-MyIP `
  --priority 110 `
  --direction Inbound `
  --protocol Tcp `
  --source-address-prefixes YOUR_PUBLIC_IP_CIDR `
  --destination-port-ranges 22 `
  --access Allow
```

Use Tailscale/WireGuard/Azure VPN Gateway when you need remote Sonarr/Radarr access.

## 3. Connect

```bash
ssh azureuser@YOUR_PUBLIC_IP
```

(Optional) assign a DNS label:

```powershell
az network public-ip update `
  --resource-group rg-eden-viewer `
  --name eden-viewer-vmPublicIP `
  --dns-name viewer-kellzkreations

# FQDN: viewer-kellzkreations.centralus.cloudapp.azure.com
```

## 4. Install Docker Engine & Compose

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin

sudo usermod -aG docker azureuser
newgrp docker  # refresh group membership
sudo systemctl enable --now docker

docker --version
docker compose version
```

## 5. Prepare Directories

```bash
sudo mkdir -p /srv/eden-viewer/appdata/{plex,sonarr,radarr}
sudo mkdir -p /srv/eden-viewer/media/{movies,tv}
sudo mkdir -p /srv/eden-viewer/transcode
sudo chown -R azureuser:azureuser /srv/eden-viewer

mkdir -p ~/eden-viewer
```

## 6. Retrieve Project Files & Configure

```bash
mkdir -p ~/eden-viewer

# Option A (recommended): copy the repo from your workstation
# From your Windows/PowerShell terminal, in the repo folder:
#   scp -r . azureuser@YOUR_PUBLIC_IP:~/eden-viewer

# Option B: clone from GitHub (only if you know the real URL)
#   git clone https://github.com/ORG_OR_USER/eden-viewer.git ~/eden-viewer

cd ~/eden-viewer/azure
cp .env.example .env
nano .env
```

Example `.env` overrides for Azure (place this in the same directory as `docker-compose.yml` or `compose.yaml`):

```dotenv
PUID=1000
PGID=1000
TZ=America/New_York

APPDATA_ROOT=/srv/eden-viewer/appdata
DATA_ROOT=/srv/eden-viewer/media
TRANSCODE_ROOT=/srv/eden-viewer/transcode
PLEX_CLAIM=  # optional; leave blank if not claiming
```

Reuse your Synology media/appdata backups if desired (`rsync` or `scp`).

> Important: run `docker compose ...` **on the Azure VM** (after SSH), not from your Windows machine.
> If you see “Found multiple config files… Using compose.yaml”, explicitly pick the file with `-f` and/or delete the one you are not using.

## 7. Deploy the Stack

From the VM:

```bash
cd ~/eden-viewer/azure

# Pick ONE compose file. If both exist, remove/rename the one you don't want:
#   rm -f compose.yaml     # if you're using docker-compose.yml
#   rm -f docker-compose.yml # if you're using compose.yaml

# Always force the env file + compose file to avoid "variable not set" + ":/data" errors:
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d
docker compose --env-file .env -f docker-compose.yml ps
```

If your repo uses `compose.yaml` instead:

```bash
docker compose --env-file .env -f compose.yaml up -d
```

## 8. Validate

- Plex: `http://<PUBLIC_IP>:32400/web`
- Sonarr/Radarr: tunnel via VPN → `http://<TUNNEL_IP>:8989` and `:7878`
- Logs: `docker compose logs -f plex` (swap service name)

Troubleshoot (`docker ps`, `docker logs <container>`, `systemctl status docker`) if services fail.

## 9. Optional: Custom DNS

```powershell
az network dns record-set a create --resource-group eden --zone-name kellzkreations.com --name viewer
az network dns record-set a add-record --resource-group eden --zone-name kellzkreations.com --record-set-name viewer --ipv4-address YOUR_PUBLIC_IP
```

Flush local DNS or wait for TTL (default 3600 s).

## 10. Backups & Maintenance

- Snapshot VM disks: `az snapshot create ...`
- Export configs: `tar czf appdata-backup.tar.gz -C /srv/eden-viewer/appdata .`
- Update containers: `docker compose pull && docker compose up -d`
- System patches: `sudo apt update && sudo apt upgrade`
- Disable VM when idle: `az vm deallocate --resource-group rg-eden-viewer --name eden-viewer-vm`

Monitor costs (`az consumption usage list ...`) and remove unused resources:

```powershell
az group delete --name rg-eden-viewer --yes --no-wait
```

## 11. HTTPS & Certificates

Azure Container Apps automatically exposes each workload at `https://<service>.<region>.azurecontainerapps.io`, terminating TLS with Microsoft-managed certificates. To harden access—especially for Sonarr/Radarr, which should remain behind VPN or zero-trust proxies—choose one of these certificate strategies:

- **Azure-managed certificate**: pointed at an Azure DNS zone, renewed automatically.
- **Azure DNS + Key Vault**: upload your own certificate (PFX) to Key Vault and bind it to each Container App.
- **Manual PEM upload**: copy full-chain/key files into the environment and mount them via the setup UI secrets.

Maintain the Synology-first posture: treat VPN (Tailscale, WireGuard, Application Gateway with SSO) as the default for managing Sonarr/Radarr, and only expose ports externally once strong authentication and TLS are verified.

### Custom domains with Azure-managed certificates

> Replace the placeholder names with your environment, app, and DNS values. The commands assume the `azure` directory `.env` still defines `APPDATA_ROOT`, `DATA_ROOT`, and `PUID/PGID` for volume mounts.

```powershell
$RG="rg-eden-viewer"
$ENV="eden-viewer-aca-env"
$APP="eden-viewer-plex"
$HOSTNAME="plex.kellzkreations.com"
$DNSZONE="kellzkreations.com"

az containerapp hostname add `
   --resource-group $RG `
   --name $APP `
   --environment $ENV `
   --hostname $HOSTNAME

az containerapp hostname enable-certificate `
   --resource-group $RG `
   --name $APP `
   --hostname $HOSTNAME `
   --certificate-type Managed `
   --dns-zone $DNSZONE

az containerapp hostname list `
   --resource-group $RG `
   --name $APP `
   --output table
```

Use the same pattern for the Sonarr/Radarr apps and confirm Azure DNS has the required CNAME or A records. Azure updates certificates automatically; check renewal status with `az containerapp hostname list` or the Azure Portal if you want confirmation emails.

### Bring-your-own certificates (BYO)

When you manage certificates yourself (Key Vault or manual PEM), mount the full chain and private key into your containers and point the setup UI at those files:

```dotenv
SETUP_UI_CERT_FILE=/certs/fullchain.pem
SETUP_UI_KEY_FILE=/certs/privkey.pem
```

Add a secret volume with those paths in `compose.yaml` / `docker-compose.yml`, or use Container Apps secrets to project the PEMs. The setup UI falls back to a self-signed cert when these variables are unset, so set both to enforce your own trusted chain.

### Plex ingress `allowInsecure`

Plex deployments use `allowInsecure: true` by default so legacy clients can fall back to HTTP. After you verify HTTPS works end-to-end, disable that fallback:

```powershell
az containerapp ingress update `
   --resource-group $RG `
   --name $APP `
   --allow-insecure false

# Re-enable only for troubleshooting labs
az containerapp ingress update `
   --resource-group $RG `
   --name $APP `
   --allow-insecure true
```

Expect a few minutes for the new ingress policy to propagate. Keep a VPN path handy in case clients cache the HTTP endpoint.

### Validate HTTPS

- From your workstation: `curl -I https://$HOSTNAME` (should return `HTTP/2 200`)
- From the Azure VM: `curl -I https://<service>.<region>.azurecontainerapps.io`
- Run the scripted check: `./smoke-test-azure.ps1 -EnvironmentName $ENV`

If any service fails the HTTPS probes, roll back to VPN-only access until certificates are healthy.

> 🛡️ VM-specific note: if you later expose the Docker stack directly from the VM, terminate TLS through a reverse proxy (Caddy, Nginx, or Apache) or `certbot`-managed Let's Encrypt certs, and keep Sonarr/Radarr restricted to VPN/zero-trust with strong auth even after HTTPS is enabled.

## Security Checklist

- Keep Sonarr/Radarr private (VPN or authenticated reverse proxy with TLS).
- Enable Plex account 2FA.
- Rotate Azure SSH keys and storage credentials.
- Monitor `docker compose logs` and `/var/log/syslog`.
- Consider Azure Firewall / Front Door for additional protection.

---

For everyday use, stay on the Synology DS923+ stack (direct play, Btrfs snapshots, Hyper Backup). Use this Azure VM guide only when remote hosting is absolutely required.

## UI/UX “Stalled” Checklist (Azure VM)

If the browser spins / times out:

1. **Confirm containers are actually running (on the VM):**

   ```bash
   cd ~/eden-viewer/azure
   docker compose --env-file .env -f docker-compose.yml ps
   docker compose --env-file .env -f docker-compose.yml logs --tail 200 plex
   ```

2. **Confirm Plex is listening locally (on the VM):**

   ```bash
   curl -I http://127.0.0.1:32400/web
   ```

3. **Confirm Azure NSG allows inbound 32400 and the VM firewall isn’t blocking:**

   ```bash
   sudo ufw status || true
   sudo ss -lntp | grep 32400 || true
   ```

4. **Test direct IP before DNS:**
   - `http://YOUR_PUBLIC_IP:32400/web`

If local `curl` fails, it’s a container/compose/env issue (not DNS). If local works but remote fails, it’s NSG/UFW/routing.
