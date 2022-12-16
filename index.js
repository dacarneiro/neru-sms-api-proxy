import dotenv from 'dotenv';
import { neru, Assets, State, Scheduler } from 'neru-alpha';
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import axios from 'axios';
import fs from 'fs';
import short from 'short-uuid';

dotenv.config();
const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static('public'));
const PORT = process.env.NERU_APP_PORT || 5001;

const session = neru.createSession();
const assets = new Assets(session);
const state = new State(session);

const currentDate = new Date().toDateString();
// console.log('ℹ️ currentDate:', currentDate);
const uuid = short.generate();
console.log('ℹ️ uuid:', uuid);
const request_logFile = os.tmpdir() + `/${uuid} request ${currentDate}.log`;
const answer_logFile = os.tmpdir() + `/${uuid} answer ${currentDate}.log`;

// TODO: TELL MUTANT TO UPDATE SERVER_URL
// const EXTERNAL_SERVER = 'http://kittphi.ngrok.io/from-inbound';
const EXTERNAL_SERVER = 'https://sheepbox.ddns.net:5001/from-inbound';

app.get('/_/health', async (req, res) => {
  res.sendStatus(200);
});

app.get('/', async (req, res, next) => {
  res.send('hello world').status(200);
});

var URL =
  process.env.ENDPOINT_URL_SCHEME + '/' + process.env.INSTANCE_SERVICE_NAME;
console.log('URL:', URL);

app.get('/_/health', async (req, res, next) => {
  res.send('OK');
});

app.post('/cleanup', async (req, res) => {
  const state = neru.getGlobalState();
  console.log('cleanup job executed', req.body);
  await state.del(req.body.key);
  res.status(200).send('OK');
});

// START TESTING: WHEN HIT THE STATE PROVIDER IS SET TO TRUE ON ALL INSTANCES
app.get('/test-start', async (req, res) => {
  let setTesting;
  let isTesting;
  try {
    setTesting = await state.set('testing', { testing: true });
    console.log('setTesting:', setTesting);
    isTesting = await state.get('testing');
    console.log('ℹ️ /test-start: testing:', isTesting);
  } catch (error) {
    console.log('❌ /test-start error:', error);
  }
  res.status(200).send(isTesting);
});

// STOP TESTING: WHEN HIT THE STATE PROVIDER IS SET TO FALSE ON ALL INSTANCES
app.get('/test-stop', async (req, res) => {
  let setTesting;
  let isTesting;
  try {
    setTesting = await state.set('testing', { testing: false });
    console.log('setTesting:', setTesting);
    isTesting = await state.get('testing');
    console.log('ℹ️ /test-start: testing:', isTesting);

    // SAVE THE LOG
    let saveRespLog = await assets
      .uploadFiles([request_logFile], '/mutant')
      .execute();
    console.log('ℹ️ saveRespLog', saveRespLog);
    let saveAnsLog = await assets
      .uploadFiles([answer_logFile], '/mutant')
      .execute();
    console.log('ℹ️ saveAnsLog', saveAnsLog);
  } catch (error) {
    console.log('❌ /test-start error:', error);
  }
  res.status(200).send(isTesting);
});

// GET TESTING STATE: GET STATE OF TEST; EITHER TRUE OR FALSE
app.get('/test-state', async (req, res) => {
  let isTesting;
  try {
    isTesting = await state.get('testing');
    console.log('ℹ️ /test-state: testing:', isTesting);
    res.send(isTesting);
  } catch (error) {
    console.log('❌ /test-state error:', error);
    res.send(isTesting);
  }
});

// Get client-ref from neru global state and send it to prefered endpoint if not expired
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

// FROM MUTANT - SAVE CLIENT REF
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

  (async () => {
    try {
      const content = JSON.stringify(req.body);
      const log = fs.createWriteStream(request_logFile, { flags: 'a' });
      log.write(`${content}\n`);
      log.end();
    } catch (err) {
      console.log('Error writing to file:', err);
      res.status(400).send({
        'Error writing to file:': err,
        request_logFile: request_logFile,
      });
    }
  })();

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

      (async () => {
        try {
          const content = JSON.stringify(response.data);
          const log = fs.createWriteStream(answer_logFile, {
            flags: 'a',
          });
          log.write(`${content}\n`);
          log.end();
        } catch (err) {
          console.log('Error writing to file:', err);
          res.status(400).send({
            'Error writing to file:': err,
            answer_logFile: answer_logFile,
          });
        }
      })();
    })
    .catch(function (error) {
      console.log(error);
      // C. IF FAILED SEND RESPONSE TO VONAGE
      res.status(404).send(error.data);
      (async () => {
        try {
          const content = JSON.stringify(error.data);
          const log = fs.createWriteStream(answer_logFile, {
            flags: 'a',
          });
          log.write(`${content}\n`);
          log.end();
        } catch (err) {
          console.log('Error writing to file:', err);
          res.status(400).send({
            'Error writing to file:': err,
            answer_logFile: answer_logFile,
          });
        }
      })();
    });
});

app.listen(PORT, () => {
  console.log(`NERU on port ${PORT}`);
});
