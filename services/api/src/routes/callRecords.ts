import { Router } from 'express';

import { appConfig } from '../config/environment';
import { GraphService } from '../services/graphService';

export const callRecordsRouter = Router();

const graphService = new GraphService();

callRecordsRouter.post('/:callId', async (req, res) => {
  const { callId } = req.params;
  const authorization = req.headers.authorization;

  if (!callId) {
    return res.status(400).json({ error: 'callId parameter is required.' });
  }

  let userAssertion = 'mock-mode';

  if (!appConfig.graph.mockMode) {
    if (!authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Bearer access token is required in the Authorization header.' });
    }

    userAssertion = authorization.slice('Bearer '.length).trim();

    if (!userAssertion) {
      return res.status(401).json({ error: 'Bearer token cannot be empty.' });
    }
  }

  try {
    const ladder = await graphService.getSipLadder(callId, userAssertion);
    return res.json({ data: ladder });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message =
      status === 401
        ? 'Unauthorized access to Microsoft Graph. Ensure the Azure AD application has CallRecords permissions.'
        : status === 404
        ? `Call record ${callId} was not found.`
        : 'Unable to retrieve call record from Microsoft Graph.';

    if (status >= 500) {
      console.error('Graph API error', error);
    }

    return res.status(status).json({ error: message });
  }
});
