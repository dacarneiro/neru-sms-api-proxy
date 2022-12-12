# neru-sms-api-proxy

## Prereq

Vonage Application:

1. Set API Settings to SMS
2. Set DLR Webhook for your NGROK server. `https://NGROK_URL/webhooks/dlr` e.g. `https://kittphi.ngrok.io/webhooks/dlr`
3. Set Inbound SMS Webhooks to your Neru Instance. e.g. `https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-neru-sms-api-proxy-sms-api/webhooks/inbound`

## To deploy app

1. Install dependencies `npm install` at root and also inside `sendSMS` folder.
2. Simulate an external server from `./externalServer` folder and use NGROK `ngrok http 5001` and start the server via `nodemon server.js`
3. Setup Neru, please see Neru Getting Started. This allows you to link to an existing Vonage Application. In root directory: `neru configure`.
4. You can also create a Vonage App via `neru app create --name "neru-app"`
   1. e.g. ✅ application successfully created - application_name="neru" application_id="5f710c44-807b-4917-a5a7-b80cb4ff1826"
5. You can set the Voange Application ID via `neru app configure`.
   E.g. neru app configure --app-id 5f710c44-807b-4917-a5a7-b80cb4ff1826 --rtc --voice
6. When done `neru init`
7. Neru deploy `neru deploy`. Save the URL.
8. Set `API Settings` at Vonage Dashboard API Settings to `SMS API` and `GET`.
9. Set DLR webhook to your NGROK URL `NGROK_URL/webhooks/dlr` and Inbound URL to `NERU_URL/webhooks/inbound` (This allows Neru to act as a Proxy to add `client_ref`).

## To demo app

1. Send an MT outbound SMS `node ./externalServer/send-sms-axios.js`. This makes an API request to the NeRu `/sms/json` route that generates a log file. A new logfile is named by Date.
2. Respond to the SMS with a MO inbound reply.
3. To see if a logFile exists for today, in browser: `https://NERU_URL/`.
4. To view a logFile by date, in browser: `https://NERU_URL/viewlog?date=Thu Dec 08 2022`.
5. To download a logFile by date, in browser: `https://NERU_URL/download?date=Thu Dec 08 2022`.

## Notes

Step 1: Send the outbound SMS as instructed above. This store client_ref inside `/sms/json` endpoint and schedules neru to delete it.

```js
const state = neru.getGlobalState();
const scheduler = new Scheduler(neru.createSession());
const reminderTime = new Date(
  // DELETE AFTER 24 HOURS
  new Date().setHours(new Date().getHours() + 24)
  // FOR TESTING: delete client_ref after 1 minute
  // new Date().setMinutes(new Date().getMinutes() + 1)
).toISOString();
// USE MSISDN AS KEY
const payloadKey = `${req.query.msisdn}`;
console.log('scheduled setup', reminderTime);
// EXECUTE CLEANUP ENDPOINT TO DELETE SAVED CLIENT_REF
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
  });
```

Cleanup Endpoint - is just a helper to delete the saved client_ref after 24 hours.

```js
app.post('/cleanup', async (req, res) => {
  const state = neru.getGlobalState();
  console.log('cleanup job executed', req.body);
  await state.del(req.body.key);
  res.status(200).send('OK');
});
```

Step 2: On Inbound webhook `/webhooks/inbound` endpoint, Neru tries to find the `client_ref` using `msisdn` (to number) as key.
If found (not expired in 24 hours) return it, if not found send without it.

```js
const state = neru.getGlobalState();
const foundEntry = await state.get(`${req.query.msisdn}`);
console.log('record retrieved:', foundEntry, req.query.msisdn);
```

### Neru server with 3 proxy endpoints

1. `sms/json` endpoint to store `client_ref`.
2. `webhooks/inbound` endpoint to lookup the `client_ref`.
3. `cleanup` endpint is used as part of a callback for scheduled deletion of the `client_ref`.

### Neru log server has 3 routes to view and download log file

1. `/` let's you know if a logFile exists for today.
2. `/viewlog` let's you search and view for logFile by date.
3. `/download` let's you search and dowload a logFile by date.

### TODO UPDATE `EXTERNAL_SERVER`

Neru acts as a Proxy. When you make an outbound SMS via `node ./externalServer/send-sms-axios.js` a request is
made to the Neru `/sms/json` endpoint. Inside there a subsequent request is made to
vonage `https://rest.nexmo.com/sms/json`. Only if the message is successfully sent to Vonage will the
`cient_ref` be saved.

Note: Edit the `EXTERNAL_SERVER` variable at `index.js` file to reflect your NGROK URL that receives DLR and Inbound.
Please see `./externalServer/server.js` for example. Run `nodemon ./externalServer/server.js` when testing.

```js
const EXTERNAL_SERVER = 'http://kittphi.ngrok.io/from-inbound';
```
