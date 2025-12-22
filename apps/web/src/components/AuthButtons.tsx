import { useMsal } from '@azure/msal-react';

import { GRAPH_SCOPES } from '../auth/msalInstance';

export const SignInButton = () => {
  const { instance } = useMsal();

  const handleClick = () => {
    instance.loginRedirect({
      scopes: GRAPH_SCOPES,
    });
  };

  return (
    <button className="btn" type="button" onClick={handleClick}>
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
