import { useMsal } from '@azure/msal-react';
import { useCallback, useState } from 'react';

import { GRAPH_SCOPES, authConfig } from '../auth/msalInstance';
import { httpClient } from '../api/httpClient';
import type { SipLadder } from '../types/ladder';

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

interface SipLadderState {
  status: FetchStatus;
  ladder: SipLadder | null;
  error: string | null;
}

const initialState: SipLadderState = {
  status: 'idle',
  ladder: null,
  error: null,
};

export const useSipLadder = () => {
  const { instance, accounts } = useMsal();
  const [state, setState] = useState<SipLadderState>(initialState);

  const fetchLadder = useCallback(async (callId: string) => {
    const trimmedCallId = callId.trim();
    if (!trimmedCallId) {
      throw new Error('Call ID is required.');
    }

    setState((current) => ({ ...current, status: 'loading', error: null }));

    let authorization: string | undefined;

    if (authConfig.isConfigured && accounts.length > 0 && GRAPH_SCOPES.length > 0) {
      try {
        const tokenResponse = await instance.acquireTokenSilent({
          account: accounts[0],
          scopes: GRAPH_SCOPES,
        });
        authorization = `Bearer ${tokenResponse.accessToken}`;
      } catch (error) {
        console.warn('Falling back to unauthenticated ladder request:', error);
      }
    }

    try {
      const response = await httpClient.post<{ data: SipLadder }>(
        `/api/call-records/${encodeURIComponent(trimmedCallId)}`,
        {},
        {
          headers: authorization ? { Authorization: authorization } : undefined,
        },
      );

      setState({ status: 'success', ladder: response.data.data, error: null });
    } catch (error) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (error as Error).message ??
        'Unable to fetch SIP ladder.';

      setState({ status: 'error', ladder: null, error: message });
      throw new Error(message);
    }
  }, [accounts, instance]);

  const reset = useCallback(() => setState(initialState), []);

  return {
    ...state,
    fetchLadder,
    reset,
  };
};
