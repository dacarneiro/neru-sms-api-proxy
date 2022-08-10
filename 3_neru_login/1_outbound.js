const axios = require('axios');
require('dotenv').config();

const VONAGE_API_KEY = process.env.VONAGE_API_KEY; // 0759237b
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET; // Test1234
const TO_NUMBER = process.env.TO_NUMBER; // 5519991827925
const FROM_NUMBER = process.env.FROM_NUMBER; // 5511953259235
let text = '';

var data = JSON.stringify({
  api_key: '0759237b',
  'client-ref':
    "{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c54'}",
  api_secret: 'Test1234',
  to: '5519991827925',
  from: '5511953259235',
  text: 'Teste de SMS callback',
  callbackData: '{"clid":33,"cid":1036729,"sid":14125,"pid":"102956318"}',
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
  })
  .catch(function (error) {
    console.log(error);
  });

// RESPONSE FROM axios-send.js
//   {
//     "messages": [
//         {
//             "to": "5519991827925",
//             "message-id": "75e3f2d6-814b-49d2-bf3c-c19fb3b46515",
//             "status": "0",
//             "remaining-balance": "10.32073000",
//             "message-price": "0.04870000",
//             "network": "72405",
//             "client-ref": "{'clid':33,'cid':1036667,'sid':14125,'pid':'617a537a-aa23-44d5-958a-e9cef6422c54'}"
//         }
//     ],
//     "message-count": "1"
// }

// DLR {
//   msisdn: '15754947093',
//   to: '5519991827925',
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
