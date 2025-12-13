@description('Name prefix for all resources')
param namePrefix string = 'mediastack'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Container Apps Environment name')
param environmentName string = '${namePrefix}-env'

@description('Log Analytics Workspace name')
param logAnalyticsName string = '${namePrefix}-logs'

@description('Storage Account name')
param storageAccountName string = '${namePrefix}${uniqueString(resourceGroup().id)}'

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Container Apps Environment
resource environment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Storage Account for media files
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Premium_LRS'
  }
  kind: 'FileStorage'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource fileServices 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

// File shares for different data types
resource appdataShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileServices
  name: 'appdata'
  properties: {
    shareQuota: 100
    enabledProtocols: 'SMB'
  }
}

resource mediaShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileServices
  name: 'media'
  properties: {
    shareQuota: 1024
    enabledProtocols: 'SMB'
  }
}

resource transcodeShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileServices
  name: 'transcode'
  properties: {
    // Premium Azure Files shares require a minimum quota; keep this at 100GB to avoid ARM deployment failures.
    shareQuota: 100
    enabledProtocols: 'SMB'
  }
}

// Storage for Container Apps - appdata
resource appdataStorage 'Microsoft.App/managedEnvironments/storages@2023-05-01' = {
  name: 'appdata-storage'
  parent: environment
  properties: {
    azureFile: {
      accountName: storageAccount.name
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: appdataShare.name
      accessMode: 'ReadWrite'
    }
  }
}

// Storage for Container Apps - media
resource mediaStorage 'Microsoft.App/managedEnvironments/storages@2023-05-01' = {
  name: 'media-storage'
  parent: environment
  properties: {
    azureFile: {
      accountName: storageAccount.name
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: mediaShare.name
      accessMode: 'ReadWrite'
    }
  }
}

// Storage for Container Apps - transcode
resource transcodeStorage 'Microsoft.App/managedEnvironments/storages@2023-05-01' = {
  name: 'transcode-storage'
  parent: environment
  properties: {
    azureFile: {
      accountName: storageAccount.name
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: transcodeShare.name
      accessMode: 'ReadWrite'
    }
  }
}

// Plex Container App
resource plexApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'plex'
  location: location
  properties: {
    environmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 32400
        transport: 'http'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'plex'
          image: 'lscr.io/linuxserver/plex:latest'
          env: [
            {
              name: 'PUID'
              value: '1000'
            }
            {
              name: 'PGID'
              value: '1000'
            }
            {
              name: 'TZ'
              value: 'America/Chicago'
            }
            {
              name: 'VERSION'
              value: 'docker'
            }
          ]
          resources: {
            cpu: json('2')
            memory: '4Gi'
          }
          volumeMounts: [
            {
              volumeName: 'appdata'
              mountPath: '/config'
            }
            {
              volumeName: 'media'
              mountPath: '/data/media'
            }
            {
              volumeName: 'transcode'
              mountPath: '/transcode'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
      volumes: [
        {
          name: 'appdata'
          storageType: 'AzureFile'
          storageName: appdataStorage.name
        }
        {
          name: 'media'
          storageType: 'AzureFile'
          storageName: mediaStorage.name
        }
        {
          name: 'transcode'
          storageType: 'AzureFile'
          storageName: transcodeStorage.name
        }
      ]
    }
  }
}

// Sonarr Container App
resource sonarrApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'sonarr'
  location: location
  properties: {
    environmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8989
        transport: 'http'
      }
    }
    template: {
      containers: [
        {
          name: 'sonarr'
          image: 'lscr.io/linuxserver/sonarr:latest'
          env: [
            {
              name: 'PUID'
              value: '1000'
            }
            {
              name: 'PGID'
              value: '1000'
            }
            {
              name: 'TZ'
              value: 'America/Chicago'
            }
          ]
          resources: {
            cpu: json('1')
            memory: '2Gi'
          }
          volumeMounts: [
            {
              volumeName: 'appdata'
              mountPath: '/config'
            }
            {
              volumeName: 'media'
              mountPath: '/data'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
      volumes: [
        {
          name: 'appdata'
          storageType: 'AzureFile'
          storageName: appdataStorage.name
        }
        {
          name: 'media'
          storageType: 'AzureFile'
          storageName: mediaStorage.name
        }
      ]
    }
  }
}

// Radarr Container App
resource radarrApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'radarr'
  location: location
  properties: {
    environmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 7878
        transport: 'http'
      }
    }
    template: {
      containers: [
        {
          name: 'radarr'
          image: 'lscr.io/linuxserver/radarr:latest'
          env: [
            {
              name: 'PUID'
              value: '1000'
            }
            {
              name: 'PGID'
              value: '1000'
            }
            {
              name: 'TZ'
              value: 'America/Chicago'
            }
          ]
          resources: {
            cpu: json('1')
            memory: '2Gi'
          }
          volumeMounts: [
            {
              volumeName: 'appdata'
              mountPath: '/config'
            }
            {
              volumeName: 'media'
              mountPath: '/data'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
      volumes: [
        {
          name: 'appdata'
          storageType: 'AzureFile'
          storageName: appdataStorage.name
        }
        {
          name: 'media'
          storageType: 'AzureFile'
          storageName: mediaStorage.name
        }
      ]
    }
  }
}

// Outputs
output plexUrl string = 'https://${plexApp.properties.configuration.ingress.fqdn}/web'
output sonarrUrl string = 'https://${sonarrApp.properties.configuration.ingress.fqdn}'
output radarrUrl string = 'https://${radarrApp.properties.configuration.ingress.fqdn}'
output storageAccountName string = storageAccount.name
output environmentName string = environment.name
