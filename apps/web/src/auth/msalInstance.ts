import { LogLevel, PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
const authority = import.meta.env.VITE_AUTHORITY ??
  (import.meta.env.VITE_AZURE_TENANT_ID
    ? `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`
    : undefined);
const redirectUri = import.meta.env.VITE_REDIRECT_URI ?? window.location.origin;

if (!clientId) {
  // eslint-disable-next-line no-console
  console.warn('VITE_AZURE_CLIENT_ID is not defined. Authentication will not function until it is configured.');
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
