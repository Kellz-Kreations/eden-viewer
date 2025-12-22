import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { SignInButton } from '../components/AuthButtons';
import { CallLookupForm } from '../components/CallLookupForm';
import { SipLadderDiagram } from '../components/SipLadderDiagram';
import { useSipLadder } from '../hooks/useSipLadder';

export const LadderPage = () => {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { status, ladder, error, fetchLadder } = useSipLadder();

  useEffect(() => {
    if (callId) {
      void fetchLadder(callId).catch(() => undefined);
    }
  }, [callId, fetchLadder]);

  const handleLookup = async (id: string) => {
    navigate(`/ladder/${encodeURIComponent(id)}`);
  };

  const requireAuth = Boolean(import.meta.env.VITE_AZURE_CLIENT_ID);
  const allowMockSample = !requireAuth;

  const ladderContent = (
    <>
      <section className="card">
        <CallLookupForm
          defaultValue={callId}
          onSubmit={handleLookup}
          loading={status === 'loading'}
          allowMockSample={allowMockSample}
          onLoadSample={() => handleLookup('sample-call')}
        />
      </section>

      {status === 'loading' ? <p className="status status--loading">Loading SIP ladder…</p> : null}
      {status === 'error' ? <p className="status status--error">{error}</p> : null}

      {ladder && status === 'success' ? (
        <section className="card">
          <header className="card__header">
            <div>
              <h3>SIP Ladder</h3>
              <p>
                {ladder.startedAt ? `Started ${new Date(ladder.startedAt).toLocaleString()}` : 'Start time unknown'}
              </p>
            </div>
            <button className="btn btn--subtle" type="button" onClick={() => void fetchLadder(callId ?? '')}>
              Refresh
            </button>
          </header>
          <SipLadderDiagram ladder={ladder} />
        </section>
      ) : null}
    </>
  );

  return (
    <div className="page page--ladder">
      <header className="page__header">
        <h2>Call ID: {callId}</h2>
        <p>Visualize SIP signaling hops captured by Microsoft Graph call records.</p>
      </header>

      {requireAuth ? (
        <>
          <AuthenticatedTemplate>{ladderContent}</AuthenticatedTemplate>
          <UnauthenticatedTemplate>
            <section className="card card--centered">
              <h3>Authentication required</h3>
              <p>Please sign in with a Microsoft account that has access to Teams call diagnostics.</p>
              <SignInButton />
            </section>
          </UnauthenticatedTemplate>
        </>
      ) : (
        ladderContent
      )}
    </div>
  );
};
