import { useMsal } from '@azure/msal-react';

import { GRAPH_SCOPES, authConfig } from '../auth/msalInstance';

interface SignInButtonProps {
  onAuthError?: (message: string) => void;
}

export const SignInButton = ({ onAuthError }: SignInButtonProps) => {
  const { instance } = useMsal();
  const unavailable = !authConfig.isConfigured;

  const notify = (message: string) => {
    if (onAuthError) {
      onAuthError(message);
    } else {
      window.alert(message);
    }
  };

  const handleClick = async () => {
    if (unavailable) {
      notify('Azure AD credentials are not configured. Update VITE_AZURE_CLIENT_ID to enable sign in.');
      return;
    }

    try {
      await instance.loginRedirect({
        scopes: GRAPH_SCOPES,
      });
    } catch (error) {
      console.error('MSAL login failed', error);
      notify((error as Error).message ?? 'Sign in failed. Please try again.');
    }
  };

  return (
    <button
      className="btn"
      type="button"
      onClick={handleClick}
      title={unavailable ? 'Configure Azure AD credentials to enable Microsoft sign in.' : undefined}
    >
      Sign in with Microsoft
    </button>
  );
};

export const SignOutButton = () => {
  const { instance, accounts } = useMsal();

  const handleClick = () => {
    const account = accounts[0];
    instance.logoutRedirect({ account });
  };

  return (
    <button className="btn btn--subtle" type="button" onClick={handleClick} disabled={accounts.length === 0}>
      Sign out
    </button>
  );
};
