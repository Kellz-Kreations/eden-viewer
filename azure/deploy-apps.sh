#!/bin/bash

# Deploy individual container apps to existing Azure Container Apps environment
# Useful for updating just one service without redeploying everything

set -e

RESOURCE_GROUP="mediastack-rg"

# Get environment name
ENV_NAME=$(az containerapp env list -g "$RESOURCE_GROUP" --query "[0].name" -o tsv)

if [ -z "$ENV_NAME" ]; then
    echo "❌ No Container Apps environment found. Run deploy.sh first."
    exit 1
fi

echo "Using environment: $ENV_NAME"

echo ""
echo "Which service do you want to deploy?"
echo "1) Plex"
echo "2) Sonarr"
echo "3) Radarr"
echo "4) All"
read -r -p "Enter choice (1-4): " choice

deploy_plex() {
    echo "🎬 Deploying Plex..."
    az containerapp create \
        --name plex \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$ENV_NAME" \
        --image lscr.io/linuxserver/plex:latest \
        --target-port 32400 \
        --ingress external \
        --cpu 2 --memory 4Gi \
        --min-replicas 1 --max-replicas 1 \
        --env-vars \
            PUID=1000 \
            PGID=1000 \
            TZ=America/Chicago \
            VERSION=docker
    
    echo "✅ Plex deployed"
}

deploy_sonarr() {
    echo "📺 Deploying Sonarr..."
    az containerapp create \
        --name sonarr \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$ENV_NAME" \
        --image lscr.io/linuxserver/sonarr:latest \
        --target-port 8989 \
        --ingress external \
        --cpu 1 --memory 2Gi \
        --min-replicas 1 --max-replicas 1 \
        --env-vars \
            PUID=1000 \
            PGID=1000 \
            TZ=America/Chicago
    
    echo "✅ Sonarr deployed"
}

deploy_radarr() {
    echo "🎥 Deploying Radarr..."
    az containerapp create \
        --name radarr \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$ENV_NAME" \
        --image lscr.io/linuxserver/radarr:latest \
        --target-port 7878 \
        --ingress external \
        --cpu 1 --memory 2Gi \
        --min-replicas 1 --max-replicas 1 \
        --env-vars \
            PUID=1000 \
            PGID=1000 \
            TZ=America/Chicago
    
    echo "✅ Radarr deployed"
}

case $choice in
    1)
        deploy_plex
        ;;
    2)
        deploy_sonarr
        ;;
    3)
        deploy_radarr
        ;;
    4)
        deploy_plex
        deploy_sonarr
        deploy_radarr
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Get URLs with:"
echo "  az containerapp list -g $RESOURCE_GROUP --query \"[].{Name:name, URL:properties.configuration.ingress.fqdn}\" -o table"
