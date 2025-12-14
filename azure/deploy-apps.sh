#!/bin/bash

# Deploy individual container apps to existing Azure Container Apps environment
# Useful for updating just one service without redeploying everything

set -e

RESOURCE_GROUP="mediastack-rg"
LOCATION="eastus"

# Get environment name
ENV_NAME=$(az containerapp env list -g "$RESOURCE_GROUP" --query "[0].name" -o tsv)

if [ -z "$ENV_NAME" ]; then
    echo "❌ No Container Apps environment found. Run deploy.sh first."
    exit 1
fi

echo "Using environment: $ENV_NAME"

# Get storage account info
STORAGE_ACCOUNT=$(az storage account list -g "$RESOURCE_GROUP" --query "[0].name" -o tsv)
STORAGE_KEY=$(az storage account keys list -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" --query "[0].value" -o tsv)

echo ""
echo "Which service do you want to deploy?"
echo "1) Plex"
echo "2) Sonarr"
echo "3) Radarr"
echo "4) All"
echo "5) Setup UI"
read -p "Enter choice (1-5): " choice

deploy_plex() {
    echo "🎬 Deploying Plex..."
    
    # Check for claim token
    if [ -z "$PLEX_CLAIM" ]; then
        echo ""
        echo "⚠️  PLEX_CLAIM not set. For first-time setup:"
        echo "   1. Go to https://www.plex.tv/claim/"
        echo "   2. Copy the token (expires in 4 minutes)"
        echo "   3. Run: export PLEX_CLAIM=claim-xxxxxxxxxxxx"
        echo "   4. Re-run this script"
        echo ""
        read -p "Continue without claim token? (y/N): " proceed
        if [ "$proceed" != "y" ] && [ "$proceed" != "Y" ]; then
            echo "Aborted."
            return 1
        fi
    fi
    
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
            VERSION=docker \
            PLEX_CLAIM="${PLEX_CLAIM:-}"
    
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

deploy_setup_ui() {
    echo "🧩 Deploying Setup UI..."

    # Image can be overridden by SETUP_UI_IMAGE env var
    SETUP_UI_IMAGE_DEFAULT="ghcr.io/kellz-kreations/eden-viewer-setup-ui:latest"
    IMAGE_REF="${SETUP_UI_IMAGE:-$SETUP_UI_IMAGE_DEFAULT}"

    echo "Using image: $IMAGE_REF"
    echo "Tip: export SETUP_UI_IMAGE=yourregistry/eden-viewer-setup-ui:tag to override"

    az containerapp create \
        --name setup-ui \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$ENV_NAME" \
        --image "$IMAGE_REF" \
        --target-port 8080 \
        --ingress external \
        --cpu 0.5 --memory 1Gi \
        --min-replicas 1 --max-replicas 1 \
        --env-vars \
            SETUP_UI_PORT=8080 \
            SETUP_UI_FIRST_RUN=true \
            PLEX_DOMAIN=${PLEX_DOMAIN:-plex.calmsky-4c04ebcd.eastus.azurecontainerapps.io}

    echo "✅ Setup UI deployed"
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
    5)
        deploy_setup_ui
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
