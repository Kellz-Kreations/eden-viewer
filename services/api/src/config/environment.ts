import dotenv from 'dotenv';

dotenv.config();

const boolFromEnv = (value: string | undefined, defaultValue = false): boolean => {
  if (typeof value === 'undefined') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const normalizeList = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const getRequired = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const tenantId = process.env.AZURE_TENANT_ID ?? '';

export const appConfig = {
  port: Number(process.env.PORT ?? 7071),
  corsOrigins: normalizeList(process.env.ALLOWED_ORIGINS),
  azure: {
    tenantId,
    clientId: process.env.AZURE_CLIENT_ID ?? '',
    clientSecret: process.env.AZURE_CLIENT_SECRET ?? '',
    authority: tenantId ? `https://login.microsoftonline.com/${tenantId}` : undefined,
  },
  graph: {
    enableBeta: boolFromEnv(process.env.GRAPH_ENABLE_BETA, true),
    mockMode: boolFromEnv(process.env.GRAPH_MOCK_MODE, true),
    scopes: (process.env.GRAPH_SCOPES ?? 'https://graph.microsoft.com/.default')
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
};

export type AppConfig = typeof appConfig;

export const assertConfiguration = (): void => {
  if (!appConfig.graph.mockMode) {
    getRequired('AZURE_TENANT_ID');
    getRequired('AZURE_CLIENT_ID');
    getRequired('AZURE_CLIENT_SECRET');
  }
};
