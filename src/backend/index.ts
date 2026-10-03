/**
 * Entry point for Backend Ingestion Engine & REST API Gateway
 */

import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Federated VCF Operations app listening on port ${PORT}`);
  });
}

export default app;
