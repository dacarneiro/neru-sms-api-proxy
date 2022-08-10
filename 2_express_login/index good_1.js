import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import flash from 'connect-flash';
import { connectDB, findOneEntry, insertEntry } from './database/mongodb.js';
import { verifyToken } from './middleware/auth.js';
const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static('public'));
app.use(flash());
app.set('view engine', 'ejs');

const PORT = process.env.NERU_APP_PORT || 5001;

var URL = '';

// Gets the URL from proccess.env properties, so ejs can use it .
if (process.env.DEBUG == 'true') {
  // https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-debug-neru-sms-api-proxy/
  console.log('debug');
} else {
  // https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-neru-sms-api-proxy-dev/
  console.log('deploy');
}

URL = process.env.ENDPOINT_URL_SCHEME + '/' + process.env.INSTANCE_SERVICE_NAME;
console.log('URL', URL);

app.get('/_/health', async (req, res, next) => {
  res.send('OK');
});

// ROOT WORKING
app.get('/', (req, res) => {
  console.log('Hello from Express Server', req.body);
  res.status(200).render('index.ejs', { URL: URL });
});

app.listen(PORT, () => {
  console.log(`NERU on port ${PORT}`);
});
