# neru-sms-api-proxy

## To run app

1. Install dependencies `npm install` at root and also inside `sendSMS` folder.
2. Use NGROK to start `EXTERNAL_SERVER` from inside the folder `sendSMS` by running `ngrok http 5001` and `nodemon server.js`
3. Setup Neru, please see Neru Getting Started. `neru configure` and `neru init`.
4. Neru deploy `neru deploy`. Save the URL.
5. Set `API Settings` at Vonage Dashboard API Settings to `SMS API` and `GET`. Add `NERU_URL/webhooks/inbound`.
6. Start an External Server for testing via `ngork http 5001` and `nodemon ./sendSMS/server.js`
7. Send an outbound SMS `node ./sendSMS/send-sms-axios.js`
8. Respond to the sms with an inbound reply.

## Notes of steps:

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

### Neru server with 3 endpoints

1. `sms/json` endpoint to store `client_ref`.
2. `webhooks/inbound` endpoint to lookup the `client_ref`.
3. `cleanup` endpint is used as part of a callback for scheduled deletion of the `client_ref`.

### TODO UPDATE `EXTERNAL_SERVER`

Neru acts as a Proxy. When you make an outbound SMS via `node ./sendSMS/send-sms-axios.js` a request is
made to the Neru `/sms/json` endpoint. Inside there a subsequent request is made to
vonage `https://rest.nexmo.com/sms/json`. Only if the message is successfully sent to Vonage will the
`cient_ref` be saved.

Note: Edit the `EXTERNAL_SERVER` to reflect your server that handles DLR and Inbound.
Please see `./sendSMS/server.js` for example. Run `nodemon ./sendSMS/server.js` when testing.

```js
const EXTERNAL_SERVER = 'http://kittphi.ngrok.io/from-inbound';
```
