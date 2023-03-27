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
const VONAGE_API_KEY = process.env.VONAGE_API_KEY;
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET;
const TO_NUMBER = process.env.TO_NUMBER;
const FROM_NUMBER = process.env.FROM_NUMBER;

var loadshare_api = 0;

// TODO: TELL MUTANT TO UPDATE SERVER_URL
const EXTERNAL_SERVER = 'https://webhooksms.mutant360.com/sms/vonage/reply';


if (process.env.DEBUG == 'true') {
  console.log(' App_Log: 🚀 Debug');

} else {
  const DeployTime = new Date
  console.log(' App_Log: 🚀 Deploy', DeployTime);

}

var URL =
  process.env.ENDPOINT_URL_SCHEME + '/' + process.env.INSTANCE_SERVICE_NAME;
console.log(' App_Log: URL:', URL);

app.get('/_/health', async (req, res, next) => {
  res.sendStatus(200);
});


app.get('/', (req, res) => {
  console.log(' App_Log: get home page');
  res.status(200).send('Hello from Neru');
});

app.post('/cleanup', async (req, res) => {
  const state = neru.getGlobalState();
  console.log(' App_Log: cleanup job executed', req.body);
  await state.delete(req.body.key);
  res.status(200).send('OK');
});

// 3. Get client-ref from neru global state and send it to prefered endpoint if not expired
app.post('/webhooks/inbound', async (req, res) => {
  console.log(' App_Log: INBOUND: ', req.body.msisdn);
  console.log(' App_Log: INBOUND', JSON.stringify(req.body));


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
  console.log(' App_Log: record retrieved:', foundEntry, req.body.msisdn);

  // IF FOUND ENTRY ADD THE CLIENT-REF, ELSE DO NOT ADD IT AND JUST PASS ALONG REQ.QUERY PARAMS.
  let inboundPayload = null;
  if (foundEntry) {

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
      console.log(' App_Log: SUCCESS sending from INBOUND To Mutant:');
      console.log(' App_Log: config:', JSON.stringify(config));
      console.log(' App_Log: 💡 status code line 165: ', response.status); // 200
      console.log(' App_Log: 💡 statusText line 166', response.statusText); // OK
      res.status(response.status).send(response.statusText);
    })
    .catch(function (error) {
      console.log(' App_Log: ERROR trying to send from INBOUND! line 170', error);
      console.log(' App_Log: 💡 error.code line 171', error.code); // ERR_BAD_REQUEST
      console.log(' App_Log: 💡 error.status line 172', error.status); // Always undefined. Should be 404
      res.status(404).send('ERR_BAD_REQUEST');
    });
});

// 1. FROM MUTANT - SAVE CLIENT REF
app.post('/sms/json', async (req, res) => {
  console.log(' App_Log:  New MT /sms/json: ', JSON.stringify(req.body));   

  //// Check if all fields are present on the MT request

  if(
    req.body.to != "" && 
    req.body.to != null && 
    req.body.from != "" && 
    req.body.from != null && 
    req.body.text != "" && 
    req.body.text != null 
    )
  {

              // INSTANTIATE THE NERU GLOBAL STATE
              const state = neru.getGlobalState();
              let dbPayload = {

                to: req.body.to,
                from: req.body.from,
                text: req.body.text,
                clientRef: req.body['client-ref'],
              };


              if (req.body.type != "unicode" )   // Check if Not Have Unicode variable
              {
                var normalized_text = req.body.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "") ;
                var data = JSON.stringify({
                  api_key: req.body['api_key'],
                  api_secret: req.body['api_secret'],
                  to: req.body.to,
                  from: req.body.from,
                  text: normalized_text,
                  'client-ref': req.body['client-ref'],
                });
              }

              else   // Have Unicode variable
              {
                var data = JSON.stringify({
                  api_key: req.body['api_key'],
                  api_secret: req.body['api_secret'],
                  to: req.body.to,
                  from: req.body.from,
                  text: req.body.text,
                  type: 'unicode',
                  'client-ref': req.body['client-ref'],
                });
              }



                var config = {
                  method: 'post',
                  url: 'https://gw-use1.api-us.prod.v1.vonagenetworks.net/sms/json',
                  // url: 'https://rest.nexmo.com/sms/json',
                  headers: {
                    'Content-Type': 'application/json',
                    'Host': 'rest.nexmo.com',
                    Accept: 'application/json',
                  },
                  data: data,
                };


              axios(config)
                .then(function (response) {

                  // B. IF SUCCESS - SAVE CLIENT_REF HERE.
                  // SCHEDULE TO DELETE STORED CLIENT_REF, THE KEY IS TO NUMBER

                  if(req.body.to != "" && req.body.to != null && req.body['client-ref']  != "" && req.body['client-ref'] != null ) //Avoid save state if the TO is empty (Neru Restart)
                  {
                          const scheduler = new Scheduler(neru.createSession());
                          const reminderTime = new Date(
                            new Date().setHours(new Date().getHours() + 24)

                          ).toISOString();
                          const payloadKey = `${req.body.to}`;

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
                              console.log(' App_Log: session saving started...', req.body.to);
                              state.set(payloadKey, dbPayload).then(() => {

                              });
                            })
                            .catch((error) => {
                              console.log(" App_Log:  Scheduler Error", error);
                            });
                  }

                  // GET RESPONSE FROM VONAGE THEN SEND IT TO MUTANT
                  res.status(response.status).send(response.data);
   
                })
                .catch(function (error) {
                  console.log(" App_Log:  Axios Error data: ", data);
                  // C. IF FAILED SEND RESPONSE TO VONAGE
                  res.status(404).send(error.data);
                });

  }
  else
  {
    res.status(400).send('Bad Request. Missing Parameters');
  }
                
});

app.listen(PORT, () => {
  console.log(`NERU on port ${PORT}`);
});
