import { Messages, Scheduler, Voice, neru } from 'neru-alpha';
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import axios from 'axios';
import { connectDB, findOneEntry, insertEntry } from './database/mongodb.js';
const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static('public'));
app.set('view engine', 'ejs');

const PORT = process.env.NERU_APP_PORT || 5001;

const { DB_NAME, DB_COLLECTION, MONGO_DB_PASSWORD } = JSON.parse(
  process.env['NERU_CONFIGURATIONS']
);

// Gets the URL from proccess.env properties, so ejs can use it .
if (process.env.DEBUG == 'true') {
  console.log('Debug');
  // https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-debug-neru-sms-api-proxy/
} else {
  console.log('Deploy');
  // https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-neru-sms-api-proxy-sms-api/
}

var URL =
  process.env.ENDPOINT_URL_SCHEME + '/' + process.env.INSTANCE_SERVICE_NAME;
console.log('URL:', URL);

app.get('/_/health', async (req, res, next) => {
  res.send('OK');
});

app.get('/', (req, res) => {
  console.log('get home page');
  res.status(200).send('Hello from Neru');
});

// 1. Get client-ref from request and store it for later use.
app.get('/webhooks/delivery-receipt', async (req, res) => {
  console.log('DLR', req.query);

  // DLR {
  //   msisdn: '15754947093',
  //   to: '19899450176',
  //   'network-code': '72405',
  //   messageId: '75e3f2d6-814b-49d2-bf3c-c19fb3b46515',
  //   price: '0.04870000',
  //   status: 'delivered',
  //   scts: '2208082036',
  //   'err-code': '0',
  //   "client-ref": "{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c54'}"
  //   'api-key': '0759237b',
  //   'message-timestamp': '2022-08-08 20:36:42'
  // }

  let result = await insertEntry({
    msisdn: req.query.msisdn,
    to: req.query.to,
    networkCode: req.query['network-code'],
    messageId: req.query.messageId,
    price: req.query.price,
    status: req.query.status,
    scts: req.query.scts,
    errCode: req.query['err-code'],
    clientRef: req.query['client-ref'],
    apiKey: req.query['api-key'],
    messageTimestamp: req.query['message-timestamp'],
  });
  res.status(200).send(result);
});

// 2. Get client-ref from mongodb and send it to prefered endpoint
app.get('/webhooks/inbound', async (req, res) => {
  console.log('INBOUND', req.query);

  // INBOUND {
  //   msisdn: '15754947093',
  //   to: '19899450176',
  //   messageId: '3000000013D6AB85',
  //   text: 'Hello',
  //   type: 'text',
  //   keyword: 'HELLO',
  //   'api-key': '4f2ff535',
  //   'message-timestamp': '2022-08-08 20:27:10'
  // }

  var text = req.query.text;
  var type = req.query.type;
  var keyword = req.query.keyword;
  var messageTimestamp = req.query['message-timestamp'];

  let result = await findOneEntry({
    msisdn: req.query.msisdn,
    to: req.query.to,
    apiKey: req.query['api-key'],
  });

  let newPayload = {
    msisdn: result.msisdn,
    to: result.to,
    messageId: result.messageId,
    text: text,
    type: type,
    keyword: keyword,
    'api-key': result.apiKey,
    'client-ref': result.clientRef,
    ['message-timestamp']: messageTimestamp,
  };

  // MODIFIED {
  //   msisdn: '15754947093',
  //   to: '19899450176',
  //   messageId: '3000000013D6AB85',
  //   text: 'Hello',
  //   type: 'text',
  //   keyword: 'HELLO',
  //   'api-key': '4f2ff535',
  //   'client-ref': 'xxxxxx'
  //   'message-timestamp': '2022-08-08 20:27:10'
  // }

  // console.log('newPayload', newPayload);

  // // TO DO: SEND IT TO PREFERRED END POINT
  var data = JSON.stringify(newPayload);

  var config = {
    method: 'post',
    url: 'https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-neru-sms-api-proxy-sms-api/sendWithClientRef',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    data: data,
  };

  axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data));
    })
    .catch(function (error) {
      console.log(error);
    });

  res.status(200).send('OK');
});

// 3. Route to where client-ref is sent.
app.post('/sendWithClientRef', (req, res) => {
  console.log('sendWithClientRef:', req.body);
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`NERU on port ${PORT}`);
});
