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

# If both exist, choose one and remove the other to prevent Compose auto-picking:
#   rm -f compose.yaml        # if you're using docker-compose.yml
#   rm -f docker-compose.yml  # if you're using compose.yaml

# Recommended: always force env + file
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
