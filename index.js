import { Messages, Scheduler, State, Voice, neru } from 'neru-alpha';
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

// Gets the URL from proccess.env properties, so ejs can use it .
if (process.env.DEBUG == 'true') {
  console.log('🚀 Debug');
  // https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-debug-neru-sms-api-proxy/
} else {
  console.log('🚀 Deploy');
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

app.post('/cleanup', async (req, res) => {
  const state = neru.getGlobalState();
  console.log('cleanup job executed', req.body);
  await state.del(req.body.key);
  res.status(200).send('OK');
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
  let expiredDate = addHours(24, date); // to test delete: 0.016 is a minute
  const state = neru.getGlobalState();

  // SEND TO DB
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

  // SEND TO MUTANT
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

  axios(config)
    .then((response) => {
      console.log('💡 SUCCESS DLR');
      console.log('💡 status', response.status); // 200
      console.log('💡 statusText', response.statusText); // OK
      res.status(response.status).send('OK');
    })
    .then(() => {
      const scheduler = new Scheduler(neru.createSession());
      const reminderTime = new Date(
        //  new Date().setHours(new Date().getHours() + 24)
        new Date().setMinutes(new Date().getMinutes() + 1)
      ).toISOString();
      const payloadKey = `${req.query.msisdn}`;
      console.log('scheduled setup', reminderTime);
      scheduler
        .startAt({
          startAt: reminderTime,
          callback: 'cleanup',
          payload: {
            key: payloadKey,
          },
        })
        .execute()
        .then(() => {
          console.log('session saved!');
        })
        .catch((error) => {
          console.log(error);
        });

      console.log('session saving started', req.query.msisdn);
      state
        .set(payloadKey, dbPayload)
        .then(() => {
          console.log('session saved!');
        })
        .catch((error) => {
          console.log(error);
        });
    })
    .catch((error) => {
      console.log('💡 ERROR SENDING DLR', error);
      console.log('💡 error.code', error.code);
      res.status(404).send('ERR_BAD_REQUEST');
    });
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
  // await deleteExpiredEntries(); // { acknowledged: true, deletedCount: 0 }

  // SAVE IN MEMORY TO PASS TO OTHER INBOUND URL
  let msisdn = req.query.msisdn;
  let to = req.query.to;
  let messageId = req.query.messageId;
  let text = req.query.text;
  let type = req.query.type;
  let keyword = req.query.keyword;
  let messageTimestamp = req.query['message-timestamp'];
  let apiKey = req.query.apiKey;

  const state = neru.getGlobalState();
  const foundEntry = await state.get(`${req.query.msisdn}`);
  console.log('record retrieved:', foundEntry, req.query.msisdn);
  // SEACH ALL UNEXPIRED ENTRIES
  // let foundEntry = await findOneEntry({
  //   msisdn: req.query.msisdn,
  //   to: req.query.to,
  //   apiKey: req.query['api-key'],
  // });

  // IF FOUND ENTRY ADD THE CLIENT-REF, ELSE DO NOT ADD IT AND JUST PASS ALONG REQ.QUERY PARAMS.
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
  } else {
    console.log('Did not find query match!', foundEntry);
    inboundPayload = {
      msisdn: msisdn,
      to: to,
      messageId: messageId,
      text: text,
      type: type,
      keyword: keyword,
      'api-key': apiKey,
      ['message-timestamp']: messageTimestamp,
    };
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

  axios(config)
    .then(function (response) {
      // console.log(JSON.stringify(response.data));
      console.log('SUCCESS sending from INBOUND!');
      console.log('💡 status', response.status); // 200
      console.log('💡 statusText', response.statusText); // OK
      res.status(response.status).send(response.statusText);
    })
    .catch(function (error) {
      console.log('ERROR trying to send from INBOUND!');
      console.log('💡 error.code', error.code); // ERR_BAD_REQUEST
      console.log('💡 error.status', error.status); // Always undefined. Should be 404
      res.status(404).send('ERR_BAD_REQUEST');
    });
});

app.listen(PORT, () => {
  console.log(`NERU on port ${PORT}`);
});
