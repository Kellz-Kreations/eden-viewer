import { LogLevel, PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID?.trim();
const authority = import.meta.env.VITE_AUTHORITY ??
  (import.meta.env.VITE_AZURE_TENANT_ID
    ? `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`
    : undefined);
const redirectUri = import.meta.env.VITE_REDIRECT_URI ?? window.location.origin;

const isAuthConfigured = Boolean(clientId);

if (!isAuthConfigured) {
  console.info(
    '[auth] VITE_AZURE_CLIENT_ID is not defined. Sign in will remain disabled until Azure AD credentials are configured.',
  );
}

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: clientId ?? '00000000-0000-0000-0000-000000000000',
    authority,
    redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        if (level === LogLevel.Error) {
          console.error(message);
        }
      },
      logLevel: LogLevel.Error,
    },
  },
});

export const GRAPH_SCOPES = (import.meta.env.VITE_GRAPH_SCOPES ?? 'CallRecords.Read.All')
  .split(' ')
  .map((scope) => scope.trim())
  .filter(Boolean);

export const authConfig = {
  isConfigured: isAuthConfigured,
  clientId: clientId ?? null,
  authority,
  redirectUri,
};
