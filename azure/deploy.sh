#!/bin/bash

# Azure Media Stack Deployment Script
# This script deploys the complete media stack to Azure Container Apps

set -e

# Configuration
RESOURCE_GROUP="mediastack-rg"
LOCATION="eastus"
DEPLOYMENT_NAME="mediastack-deployment-$(date +%s)"

echo "🚀 Deploying Media Stack to Azure..."
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo ""

# Check if logged in to Azure
echo "Checking Azure CLI login..."
az account show > /dev/null 2>&1 || {
    echo "❌ Not logged in to Azure. Please run 'az login' first."
    exit 1
}

echo "✅ Logged in to Azure"
echo ""

# Create resource group if it doesn't exist
echo "Creating resource group..."
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none

echo "✅ Resource group ready"
echo ""

# Deploy the Bicep template
echo "Deploying infrastructure (this takes 5-10 minutes)..."
echo "⏳ Creating storage, container apps environment, and all services..."
echo ""

az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --template-file main.bicep \
    --parameters parameters.json

echo ""
echo "✅ Deployment complete!"
echo ""

# Get outputs
echo "📋 Service URLs:"
echo ""

PLEX_URL=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query properties.outputs.plexUrl.value \
    -o tsv)

SONARR_URL=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query properties.outputs.sonarrUrl.value \
    -o tsv)

RADARR_URL=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query properties.outputs.radarrUrl.value \
    -o tsv)

STORAGE_ACCOUNT=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query properties.outputs.storageAccountName.value \
    -o tsv)

echo "🎬 Plex:   $PLEX_URL"
echo "📺 Sonarr: $SONARR_URL"
echo "🎥 Radarr: $RADARR_URL"
echo ""
echo "💾 Storage Account: $STORAGE_ACCOUNT"
echo ""

echo "🎉 All services are now running!"
echo ""
echo "Next steps:"
echo "1. Open Plex and complete the initial setup"
echo "2. Upload media files to Azure Files (see README.md)"
echo "3. Configure Sonarr and Radarr"
echo ""
echo "To view logs:"
echo "  az containerapp logs show --name plex -g $RESOURCE_GROUP --follow"
echo ""
echo "To delete everything:"
echo "  az group delete --name $RESOURCE_GROUP --yes"
