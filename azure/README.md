# Azure Deployment Guide

Complete guide for deploying the media stack to Azure Container Apps with persistent storage.

## Prerequisites

- Azure CLI installed (`az --version`)
- Active Azure subscription
- Logged in to Azure (`az login`)

## Cost Warning ⚠️

**This deployment will incur ongoing Azure costs:**

| Resource | Monthly Cost (Est.) |
|----------|---------------------|
| Container Apps Environment | $50 |
| Plex (2 CPU, 4 GB, always-on) | $80-100 |
| Sonarr (1 CPU, 2 GB, always-on) | $40-50 |
| Radarr (1 CPU, 2 GB, always-on) | $40-50 |
| Azure Files Premium (1.2 TB) | $150 |
| Log Analytics | $10 |
| **Total** | **~$370-410/month** |

**Cost optimization tips:**
- Use scale-to-zero for services you don't need 24/7
- Use Standard storage tier instead of Premium (slower but cheaper)
- Deploy in cheaper regions (e.g., Central US vs East US)

## Quick Start

### 1. Register Azure Providers (One-time)

```bash
az provider register -n Microsoft.App --wait
az provider register -n Microsoft.OperationalInsights --wait
az provider register -n Microsoft.Storage --wait
```

This takes 2-3 minutes.

### 2. Deploy Everything

```bash
cd azure
chmod +x deploy.sh
./deploy.sh
```

Deployment takes 5-10 minutes. The script will:
- Create resource group
- Deploy storage account with file shares
- Create Container Apps environment
- Deploy Plex, Sonarr, and Radarr with persistent storage
- Output all service URLs

### 3. Access Your Services

URLs will be displayed at the end, like:
```
🎬 Plex:   https://plex.xxx.eastus.azurecontainerapps.io/web
📺 Sonarr: https://sonarr.xxx.eastus.azurecontainerapps.io
🎥 Radarr: https://radarr.xxx.eastus.azurecontainerapps.io
```

## What Gets Deployed

### Infrastructure
- **Resource Group:** `mediastack-rg`
- **Container Apps Environment:** Isolated environment for all containers
- **Log Analytics Workspace:** Centralized logging and monitoring
- **Storage Account (Premium):** High-performance file storage

### Storage Shares
- `appdata` (100 GB) - Application configs for Plex/Sonarr/Radarr
- `media` (1 TB) - Your movies and TV shows
- `transcode` (100 GB) - Temporary transcoding files (Premium shares require a minimum quota)

### Container Apps
All with persistent storage mounted:
- **Plex** (2 CPU, 4 GB RAM) - Port 32400
- **Sonarr** (1 CPU, 2 GB RAM) - Port 8989
- **Radarr** (1 CPU, 2 GB RAM) - Port 7878

## Customization

### Change Region or Names

Edit `parameters.json`:
```json
{
  "parameters": {
    "namePrefix": {
      "value": "mystack"
    },
    "location": {
      "value": "westus2"
    }
  }
}
```

### Change Resource Sizes

Edit `main.bicep` to adjust:
- CPU/memory allocations
- Storage quotas
- Replica counts

## Managing Media Files

### Upload Files to Azure

```bash
# Get storage account details
STORAGE_ACCOUNT=$(az storage account list -g mediastack-rg --query "[0].name" -o tsv)
STORAGE_KEY=$(az storage account keys list -g mediastack-rg -n $STORAGE_ACCOUNT --query "[0].value" -o tsv)

# Upload movies
az storage file upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY \
  --destination media/movies \
  --source /path/to/your/movies

# Upload TV shows
az storage file upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY \
  --destination media/tv \
  --source /path/to/your/tv-shows
```

### Mount Azure Files Locally (Windows)

```powershell
# Get credentials
$storageAccount = az storage account list -g mediastack-rg --query "[0].name" -o tsv
$storageKey = az storage account keys list -g mediastack-rg -n $storageAccount --query "[0].value" -o tsv

# Mount as network drive
net use Z: \\$storageAccount.file.core.windows.net\media /user:Azure\$storageAccount $storageKey
```

## Operations

## Testing (Smoke)

Run a quick validation of the Azure deployment (template compiles/validates, apps are running, and service URLs are reachable):

```powershell
pwsh -NoProfile -File .\smoke-test-azure.ps1
```

If you only want to validate Azure resources and skip HTTP reachability checks:

```powershell
pwsh -NoProfile -File .\smoke-test-azure.ps1 -SkipHttpChecks
```

### View Logs

```bash
# Plex logs
az containerapp logs show --name plex -g mediastack-rg --follow

# All apps
az containerapp logs show --name sonarr -g mediastack-rg --follow
az containerapp logs show --name radarr -g mediastack-rg --follow
```

### Restart a Container

```bash
az containerapp revision restart --name plex -g mediastack-rg
```

### Check Status

```bash
az containerapp list -g mediastack-rg --query "[].{Name:name, Status:properties.runningStatus, URL:properties.configuration.ingress.fqdn}" -o table
```

### Scale Resources

```bash
# Scale Plex to 4 CPUs, 8 GB
az containerapp update \
  --name plex \
  -g mediastack-rg \
  --cpu 4 \
  --memory 8Gi
```

### Update Container Image

```bash
az containerapp update \
  --name plex \
  -g mediastack-rg \
  --image lscr.io/linuxserver/plex:latest
```

## Individual App Deployment

To deploy or update just one service:

```bash
chmod +x deploy-apps.sh
./deploy-apps.sh
```

Select which app to deploy (Plex, Sonarr, Radarr, or all).

## Monitoring

### View in Azure Portal

```bash
az containerapp browse --name plex -g mediastack-rg
```

### Cost Analysis

```bash
# View current month costs
az consumption usage list \
  --start-date $(date -d "1 month ago" +%Y-%m-%d) \
  --end-date $(date +%Y-%m-%d) \
  | jq '.[] | select(.instanceName | contains("mediastack"))'
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
az containerapp logs show --name plex -g mediastack-rg --tail 100

# Check revision status
az containerapp revision list --name plex -g mediastack-rg -o table
```

### Storage Issues

```bash
# Verify shares exist
az storage share list --account-name $(az storage account list -g mediastack-rg --query "[0].name" -o tsv) -o table

# Check if mounted correctly
az containerapp show --name plex -g mediastack-rg --query "properties.template.volumes"
```

### Network/Ingress Issues

```bash
# Verify ingress configuration
az containerapp show --name plex -g mediastack-rg --query "properties.configuration.ingress"

# Test connectivity
curl -I https://plex.xxx.eastus.azurecontainerapps.io/web
```

## Complete Cleanup

**⚠️ This deletes everything permanently, including all media files!**

```bash
az group delete --name mediastack-rg --yes --no-wait
```

## Security Considerations

- All services are exposed to the internet with HTTPS
- Consider adding authentication via Azure AD
- Use Azure Front Door for DDoS protection
- Enable Azure Firewall for IP restrictions
- Rotate storage account keys regularly

## Next Steps

1. Complete Plex setup at the web URL
2. Upload your media files to Azure Files
3. Configure Sonarr and Radarr to use `/data` paths
4. Set up automated backups of the `appdata` share

## Support

- View logs: `az containerapp logs show`
- Check status: `az containerapp show`
- Review costs: Azure Portal → Cost Management
- File issues: GitHub repository issues page

# Eden Viewer - Azure Deployment

> ⚠️ **Different Scope**: This configuration is for Azure VM hosting, separate from the main Synology DS923+ project.

## Overview

This directory contains configuration for hosting the media stack on an Azure VM instead of a local Synology NAS.

## Prerequisites

- Azure subscription
- Azure CLI installed
- Docker-capable VM (Ubuntu 22.04 LTS recommended)

## Recommended Azure Resources

| Resource | Recommendation |
|----------|---------------|
| VM Size | Standard_B2s (2 vCPU, 4GB) minimum |
| OS Disk | 64GB Premium SSD |
| Data Disk | Standard HDD (size based on library) |
| Region | Closest to your location |

## Quick Start

```bash
# 1. Create resource group
az group create --name eden-viewer-rg --location eastus

# 2. Create VM
az vm create \
  --resource-group eden-viewer-rg \
  --name eden-viewer-vm \
  --image Ubuntu2204 \
  --size Standard_B2s \
  --admin-username azureuser \
  --generate-ssh-keys

# 3. SSH into VM and run setup
ssh azureuser@<VM-PUBLIC-IP>
```

## Security (Critical)

**Azure VMs are internet-exposed by default.** You MUST:

1. **Use NSG rules** - Only allow necessary ports
2. **Enable authentication** - Set passwords in Sonarr/Radarr
3. **Use HTTPS** - Put a reverse proxy (Caddy/nginx) in front
4. **Consider VPN** - Azure VPN Gateway or Tailscale

### Recommended NSG Rules

| Priority | Port | Source | Action | Purpose |
|----------|------|--------|--------|---------|
| 100 | 22 | Your IP | Allow | SSH |
| 110 | 32400 | Any | Allow | Plex |
| 120 | 443 | Any | Allow | HTTPS (reverse proxy) |
| 200 | 8989 | Your IP | Allow | Sonarr (restrict!) |
| 210 | 7878 | Your IP | Allow | Radarr (restrict!) |
| 4096 | * | Any | Deny | Default deny |

## Cost Considerations

| Component | Est. Monthly Cost |
|-----------|------------------|
| B2s VM | ~$30-40 |
| 64GB Premium SSD | ~$10 |
| 1TB Standard HDD | ~$40 |
| Egress (streaming) | Variable |

**Total**: ~$80-100+/month (vs. one-time NAS purchase)

## When to Use Azure vs Synology

| Use Case | Recommendation |
|----------|---------------|
| Home media server | Synology NAS |
| No home internet/power | Azure |
| Remote-first access | Azure |
| Cost-sensitive | Synology NAS |
| Full control/privacy | Synology NAS |

---

> **Recommendation**: For most home users, the Synology DS923+ setup in the [main project](../) is more cost-effective and private.
