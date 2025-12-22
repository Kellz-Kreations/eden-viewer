import cors from 'cors';
import express from 'express';

import { appConfig, assertConfiguration } from './config/environment';
import { callRecordsRouter } from './routes/callRecords';

assertConfiguration();

const app = express();

app.use(express.json({ limit: '1mb' }));

if (appConfig.corsOrigins.length === 0) {
  app.use(cors());
} else {
  app.use(
    cors({
      origin: appConfig.corsOrigins,
      credentials: true,
    }),
  );
}

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/call-records', callRecordsRouter);

const port = appConfig.port;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Teams SIP Ladder API listening on port ${port}`);
});
