require('dotenv').config();
const axios = require('axios');
const VONAGE_API_KEY = process.env.VONAGE_API_KEY;
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET;
const TO_NUMBER = process.env.TO_NUMBER;
const FROM_NUMBER = process.env.FROM_NUMBER;

var data = JSON.stringify({
  api_key: VONAGE_API_KEY,
  'client-ref':
    "{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c57'}",
  api_secret: VONAGE_API_SECRET,
  from: FROM_NUMBER,
  to: TO_NUMBER,
  text: 'This is an outgoing sms',
});

// SEND TO NERU - NERU_URL/sms/json
var config = {
  method: 'post',
  // url: 'https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-neru-sms-api-proxy-sms-api/sms/json',
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
    // {"messages":[{"to":"15754947093","message-id":"46da5047-158e-4571-923e-5478f2e54913","status":"0","remaining-balance":"70.81686346","message-price":"0.00952000","network":"310090","client-ref":"{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c54'}"}],"message-count":"1"}
  })
  .catch(function (error) {
    console.log(error);
  });
