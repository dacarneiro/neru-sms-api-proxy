const app = require('express')();
const bodyParser = require('body-parser');
const PORT = process.env.PORT || 5001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).send('Hello from Express!');
});

// Receive DLR from Vonage DLR
app.get('/webhooks/dlr', (req, res) => {
  console.log('webhooks/dlr:', req.query);
  res.status(200).send('OK');
});

// webhooks/dlr: {
//   msisdn: '15754947093',
//   to: '19899450176',
//   'network-code': '310090',
//   messageId: '38eef590-711f-4360-a23d-80c38291eb1d',
//   price: '0.00952000',
//   status: 'delivered',
//   scts: '2209012322',
//   'err-code': '0',
//   'client-ref': "{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c57'}",
//   'api-key': '4f2ff535',
//   'message-timestamp': '2022-09-01 23:22:08'
// }

app.post('/from-inbound', (req, res) => {
  console.log('from-inbound:', req.body);
  res.status(200).send('OK');
});

// from-inbound: {
//   to: '15754947093',
//   messageId: '2F000000173F1D04',
//   text: 'Hello back',
//   type: 'text',
//   keyword: 'HELLO',
//   'client-ref': "{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c56'}",
//   'message-timestamp': '2022-09-01 23:22:33'
// }

app.listen(PORT, () => {
  console.log(`External Server on port ${PORT}`);
});
