import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';

import { CallLookupForm } from '../components/CallLookupForm';
import { SignInButton } from '../components/AuthButtons';

const requireAuth = Boolean(import.meta.env.VITE_AZURE_CLIENT_ID);
const allowMockSample = !requireAuth;

export const HomePage = () => {
  const navigate = useNavigate();

  const handleSubmit = async (callId: string) => {
    navigate(`/ladder/${encodeURIComponent(callId)}`);
  };

  return (
    <div className="page page--home">
      <header className="page__header">
        <h2>Microsoft Teams SIP Ladder Viewer</h2>
        <p>
          Retrieve SIP signaling details for a Teams call using its unique call ID from Microsoft Graph Call Records.
        </p>
      </header>

      {requireAuth ? (
        <>
          <AuthenticatedTemplate>
            <section className="card">
              <h3>Lookup a call</h3>
              <CallLookupForm onSubmit={handleSubmit} />
            </section>
            <section className="card card--muted">
              <h3>Tip</h3>
              <p>
                Your tenant admin must grant the application <code>CallRecords.Read.All</code> permission for SIP ladder
                retrieval. Provide the call ID from Teams Call Analytics or CQD logs.
              </p>
            </section>
          </AuthenticatedTemplate>

          <UnauthenticatedTemplate>
            <section className="card card--centered">
              <h3>Sign in to get started</h3>
              <p>Authenticate with your Microsoft 365 account to query Microsoft Graph for call diagnostics.</p>
              <SignInButton />
            </section>
          </UnauthenticatedTemplate>
        </>
      ) : (
        <section className="card">
          <h3>Lookup a call</h3>
          <CallLookupForm
            onSubmit={handleSubmit}
            allowMockSample={allowMockSample}
            onLoadSample={() => handleSubmit('sample-call')}
          />
          <p className="card__footnote">
            Authentication is disabled in mock mode. Requests are served from local fixture data to help you explore the
            experience before configuring Azure AD.
          </p>
        </section>
      )}
    </div>
  );
};
