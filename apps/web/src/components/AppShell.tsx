import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { Outlet } from 'react-router-dom';

import { SignInButton, SignOutButton } from './AuthButtons';

export const AppShell = () => {
  const { accounts } = useMsal();
  const activeAccount = accounts[0];

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <span className="app-shell__logo" aria-hidden="true">
            🔭
          </span>
          <div>
            <h1>Teams SIP Ladder Viewer</h1>
            <p>Visualize Microsoft Teams call signaling in seconds.</p>
          </div>
        </div>
        <div className="app-shell__auth">
          <AuthenticatedTemplate>
            <div className="app-shell__account">
              <span className="app-shell__avatar" aria-hidden>
                {activeAccount?.name?.[0] ?? 'A'}
              </span>
              <div>
                <span className="app-shell__account-name">{activeAccount?.name}</span>
                <span className="app-shell__account-username">{activeAccount?.username}</span>
              </div>
            </div>
            <SignOutButton />
          </AuthenticatedTemplate>
          <UnauthenticatedTemplate>
            <SignInButton />
          </UnauthenticatedTemplate>
        </div>
      </header>
      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  );
};
