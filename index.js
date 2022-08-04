import express from 'express';
import bodyParser from 'body-parser';
import { Messages, Scheduler, Voice, neru } from 'neru-alpha';

const app = express();
app.use(bodyParser.json());

app.get('/', async (req, res, next) => {
  console.log('Route has been reached');
  res.send('🚀 Hello from Neru Server 🚀');
});

app.get('/_/health', async (req, res, next) => {
  res.send('OK');
});

app.listen(process.env.NERU_APP_PORT, () => {
  console.log(`Example app listening on port ${process.env.NERU_APP_PORT}`);
});
