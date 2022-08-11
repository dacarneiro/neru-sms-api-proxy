import { Messages, Scheduler, Voice, neru } from 'neru-alpha';
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import axios from 'axios';
import {
  deleteExpiredEntries,
  findOneEntry,
  insertEntry,
} from './database/mongodb.js';
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

const addHours = (numOfHours, date = new Date()) => {
  date.setTime(date.getTime() + numOfHours * 60 * 60 * 1000);
  return date.toISOString();
};

// 1. Get client-ref from request and store it for later use.
app.get('/webhooks/delivery-receipt', async (req, res) => {
  // console.log('DLR', req.query);
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

  // CREATE EXPIRED TIME BY ADDING 24 HOURS TO CURRENT TIME
  let date = new Date();
  let expiredDate = addHours(24, date);

  let dbPayload = {
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
    date: expiredDate,
  };

  // STORE OUTBOUND SMS TO DB.
  let result = await insertEntry(dbPayload);

  // SEND
  let dlrPayload = {
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
  };

  // console.log('dlrPayload:', dlrPayload);

  if (result) {
    console.log('Entry created:', result);
    // MAKE ANOTHER REQUEST TO SEND DLR TO MUTANT
    // GET RESPONSE FROM MUTANT
    var data = JSON.stringify(dlrPayload);

    var config = {
      method: 'post',
      url: 'http://kittphi.ngrok.io/from-dlr',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: data,
    };

    // TO DO: SEND 200 IF SUCCESS OR 400??? IF FAIL
    axios(config)
      .then(function (response) {
        console.log('status:', response.status); // 200
        console.log('statusText:', response.statusText); // OK
        // res.status(response.status).send(response.statusText);
        res.status(200).send('OK');
      })
      .catch(function (error) {
        console.log('ERROR trying to send from DLR!', JSON.stringify(error));
        res.status(error.status).send(error.statusText);
      });
  }

  // res.status(200).send('OK'); // GOES TO VONAGE
});

// 2. Get client-ref from mongodb and send it to prefered endpoint
app.get('/webhooks/inbound', async (req, res) => {
  // console.log('INBOUND', req.query);

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

  // DELETE ALL EXPIRED ENTRIES BEFORE SEARCHING
  const isExpired = await deleteExpiredEntries();
  if (isExpired) {
    console.log('isExpired True:', isExpired);
  } else {
    console.log('isExpired False:', isExpired);
  }
  console.log('Deleted ' + isExpired.deletedCount + ' documents');

  // SAVE IN MEMORY TO PASS TO OTHER INBOUND URL
  var text = req.query.text;
  var type = req.query.type;
  var keyword = req.query.keyword;
  var messageTimestamp = req.query['message-timestamp'];
  var messageId = req.query.messageId;

  // SEACH ALL UNEXPIRED ENTRIES
  let foundEntry = await findOneEntry({
    msisdn: req.query.msisdn,
    to: req.query.to,
    apiKey: req.query['api-key'],
  });

  // IF FOUND ENTRY ADD THE CLIENT-REF, ELSE DO NOT. ALSO PASS ALONG REQ.QUERY PARAMS.
  let inboundPayload = null;
  if (foundEntry) {
    console.log('Found query match!', foundEntry);

    inboundPayload = {
      msisdn: foundEntry.msisdn,
      to: foundEntry.to,
      messageId: messageId,
      text: text,
      type: type,
      keyword: keyword,
      'api-key': foundEntry.apiKey,
      'client-ref': foundEntry.clientRef,
      ['message-timestamp']: messageTimestamp,
    };
  } else if (!foundEntry) {
    console.log('Did not find query match!', foundEntry);
    inboundPayload = {
      msisdn: foundEntry.msisdn,
      to: foundEntry.to,
      messageId: messageId,
      text: text,
      type: type,
      keyword: keyword,
      'api-key': foundEntry.apiKey,
      ['message-timestamp']: messageTimestamp,
    };
  } else {
    console.log('OOOPS something else was found', foundEntry);
  }

  // SEND TO PREFERRED OTHER INBOUND URL
  var data = JSON.stringify(inboundPayload);

  var config = {
    method: 'post',
    url: 'http://kittphi.ngrok.io/from-inbound',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    data: data,
  };

  // TO DO: SEND 200 IF SUCCESS OR 400??? IF FAIL
  axios(config)
    .then(function (response) {
      // console.log(JSON.stringify(response.data));
      console.log(response.status); // 200
      console.log(response.statusText); // OK
      res.status(response.status).send(response.statusText);
    })
    .catch(function (error) {
      console.log('ERROR trying to send from Inbound!', JSON.stringify(error));
      console.log('Code:', error.code);
      // console.log('Status:', error.status); // undefined
      res.status(404).send(error.code);
    });

  // res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`NERU on port ${PORT}`);
});
