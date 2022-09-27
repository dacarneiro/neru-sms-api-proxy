import dotenv from 'dotenv';
import { Scheduler, neru } from 'neru-alpha';
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import axios from 'axios';
dotenv.config();
const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static('public'));

const PORT = process.env.NERU_APP_PORT || 5001;

// TODO: TELL MUTANT TO UPDATE SERVER_URL
const EXTERNAL_SERVER = 'http://kittphi.ngrok.io/from-inbound';

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

// 3. Get client-ref from neru global state and send it to prefered endpoint if not expired
app.get('/webhooks/inbound', async (req, res) => {
  console.log('INBOUND', req.query);

  // INBOUND {
  //   msisdn: '15754947093',
  //   to: '19899450176',
  //   messageId: '3000000013D6AB85',
  //   text: 'Hello',
  //   type: 'text',
  //   keyword: 'HELLO',
  //   'api-key': '',
  //   'message-timestamp': '2022-08-08 20:27:10'
  // }

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
    url: `${EXTERNAL_SERVER}`,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    data: data,
  };

  axios(config)
    .then(function (response) {
      console.log('SUCCESS sending from INBOUND!');
      console.log('💡 status', response.status); // 200
      console.log('💡 statusText', response.statusText); // OK
      res.status(response.status).send(response.statusText);
    })
    .catch(function (error) {
      console.log('ERROR trying to send from INBOUND!', error);
      console.log('💡 error.code', error.code); // ERR_BAD_REQUEST
      console.log('💡 error.status', error.status); // Always undefined. Should be 404
      res.status(404).send('ERR_BAD_REQUEST');
    });
});

// 1. FROM MUTANT - SAVE CLIENT REF
app.post('/sms/json', async (req, res) => {
  console.log('/sms/json', req.body);
  // /sms/json {
  //   "api_key": "",
  //   "client-ref": "{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c57'}",
  //   "api_secret": "",
  //   "to": "15754947093",
  //   "from": "19899450176",
  //   "text": "This is an outgoing sms"
  // }

  // INSTANTIATE THE NERU GLOBAL STATE
  const state = neru.getGlobalState();
  let dbPayload = {
    // api_key: req.body['api_key'],
    // api_secret: req.body['api_secret'],
    to: req.body.to,
    from: req.body.from,
    text: req.body.text,
    clientRef: req.body['client-ref'],
  };

  // A. NEW POST REQUEST TO VONAGE https://rest.nexmo.com/sms/json
  var data = JSON.stringify({
    api_key: req.body['api_key'],
    api_secret: req.body['api_secret'],
    to: req.body.to,
    from: req.body.from,
    text: req.body.text,
    'client-ref': req.body['client-ref'],
  });

  var config = {
    method: 'post',
    url: 'https://rest.nexmo.com/sms/json',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    data: data,
  };
  axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data));
      // B. IF SUCCESS - SAVE CLIENT_REF HERE.
      // SCHEDULE TO DELETE STORED CLIENT_REF, THE KEY IS TO NUMBER
      const scheduler = new Scheduler(neru.createSession());
      const reminderTime = new Date(
        new Date().setHours(new Date().getHours() + 24)
        // new Date().setMinutes(new Date().getMinutes() + 1)
      ).toISOString();
      const payloadKey = `${req.body.to}`;
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
          console.log('session saving started...', req.body.to);
          state.set(payloadKey, dbPayload).then(() => {
            console.log('session saved!');
          });
        })
        .catch((error) => {
          console.log(error);
        });

      // GET RESPONSE FROM VONAGE THEN SEND IT TO MUTANT
      res.status(response.status).send(response.data);
      // {"messages":[{"to":"15754947093","message-id":"46da5047-158e-4571-923e-5478f2e54913","status":"0","remaining-balance":"70.81686346","message-price":"0.00952000","network":"310090","client-ref":"{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c54'}"}],"message-count":"1"}
    })
    .catch(function (error) {
      console.log(error);
      // C. IF FAILED SEND RESPONSE TO VONAGE
      res.status(404).send(error.data);
    });
});

// 1. VIDS POST TO SAVE CLIENT REF
app.post('/vids/sms/json', async (req, res) => {
  console.log('🚀 /vids/sms/json', req.body);
  // /sms/json {
  //   "api_key": "",
  //   "client-ref": "{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c57'}",
  //   "api_secret": "",
  //   "to": "15754947093",
  //   "from": "19899450176",
  //   "text": "This is an outgoing sms",
  //   "expire": 2,
  // }

  // INSTANTIATE THE NERU GLOBAL STATE
  const state = neru.getGlobalState();
  let dbPayload = {
    // api_key: req.body['api_key'],
    // api_secret: req.body['api_secret'],
    to: req.body.to,
    from: req.body.from,
    text: req.body.text,
    clientRef: req.body['client-ref'],
  };

  // A. NEW POST REQUEST TO VONAGE https://rest.nexmo.com/sms/json
  var data = JSON.stringify({
    api_key: req.body['api_key'],
    api_secret: req.body['api_secret'],
    to: req.body.to,
    from: req.body.from,
    text: req.body.text,
    'client-ref': req.body['client-ref'],
  });

  var config = {
    method: 'post',
    url: 'https://rest.nexmo.com/sms/json',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    data: data,
  };
  axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data));
      // B. IF SUCCESS - SAVE CLIENT_REF HERE.
      // SCHEDULE TO DELETE STORED CLIENT_REF, THE KEY IS TO NUMBER
      const scheduler = new Scheduler(neru.createSession());

      // const expiredTime = req.body.time;

      const expiredTime = new Date(
        // new Date().setHours(new Date().getHours() + 24)
        new Date().setMinutes(new Date().getMinutes() + 1)
      ).toISOString();

      const payloadKey = `${req.body.to}`;
      console.log('✅ Scheduled cleanup', expiredTime.toLocaleString());
      scheduler
        .startAt({
          startAt: expiredTime,
          callback: 'cleanup',
          payload: {
            key: payloadKey,
          },
        })
        .execute()
        .then(() => {
          console.log('session saving started...', req.body.to);
          state.set(payloadKey, dbPayload).then(() => {
            console.log('session saved!');
          });
        })
        .catch((error) => {
          console.log(error);
        });

      // GET RESPONSE FROM VONAGE THEN SEND IT TO MUTANT
      res.status(response.status).send(response.data);
      // {"messages":[{"to":"15754947093","message-id":"46da5047-158e-4571-923e-5478f2e54913","status":"0","remaining-balance":"70.81686346","message-price":"0.00952000","network":"310090","client-ref":"{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c54'}"}],"message-count":"1"}
    })
    .catch(function (error) {
      console.log(error);
      // C. IF FAILED SEND RESPONSE TO VONAGE
      res.status(404).send(error.data);
    });
});

// 2. VIDS INBOUND TO RETRIEVE CLIENT REF
app.post('/vids/inbound', async (req, res) => {
  console.log('🚀 /vids/inboud', req.body);

  // INBOUND {
  //   msisdn: '15754947093',
  //   to: '12016279133',
  //   messageId: '3000000013D6AB85',
  //   text: 'Hello',
  //   type: 'text',
  //   keyword: 'HELLO',
  //   'api-key': '',
  //   'message-timestamp': '2022-09-26T20:36:25Z'
  // }

  // SAVE IN MEMORY TO PASS TO OTHER INBOUND URL
  let msisdn = req.body.msisdn;
  let to = req.body.to;
  let messageId = req.body.messageId;
  let text = req.body.text;
  let type = req.body.type;
  let keyword = req.body.keyword;
  let messageTimestamp = req.body['message-timestamp'];
  let apiKey = req.body.apiKey;

  const state = neru.getGlobalState();
  const foundEntry = await state.get(`${req.body.msisdn}`);
  console.log('✅ record retrieved:', foundEntry);
  console.log('msisdn', req.body.msisdn);

  // IF FOUND ENTRY ADD THE CLIENT-REF, ELSE DO NOT ADD IT AND JUST PASS ALONG REQ.QUERY PARAMS.
  let inboundPayload = null;
  if (foundEntry) {
    console.log('✅ Found query match!', foundEntry);

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
    console.log('❌ Did not find query match!', foundEntry);
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

  // RETURN RESULT TO VIDS MO REQUEST
  var data = JSON.stringify(inboundPayload);

  res.status(200).send(data);
});

app.listen(PORT, () => {
  console.log(`NERU on port ${PORT}`);
});
