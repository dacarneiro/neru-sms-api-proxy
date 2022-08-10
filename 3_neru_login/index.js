import { Messages, Scheduler, Voice, neru } from 'neru-alpha';
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

// NERU ENV - see neru.yml
// const DB_NAME = JSON.parse(process.env['NERU_CONFIGURATIONS']).DB_NAME;
// console.log('DB_NAME', DB_NAME);
// const DB_COLLECTION = JSON.parse(
//   process.env['NERU_CONFIGURATIONS']
// ).DB_COLLECTION;
// console.log('DB_COLLECTION', DB_COLLECTION);
// const MONGO_DB_PASSWORD = JSON.parse(
//   process.env['NERU_CONFIGURATIONS']
// ).MONGO_DB_PASSWORD;
// console.log('MONGO_DB_PASSWORD', MONGO_DB_PASSWORD);
// console.log('neru.config.DB_NAME', neru.config.DB_NAME);

// Gets the URL from proccess.env properties, so ejs can use it .
if (process.env.DEBUG == 'true') {
  console.log('Debug');
} else {
  console.log('Deploy');
}

var URL =
  process.env.ENDPOINT_URL_SCHEME + '/' + process.env.INSTANCE_SERVICE_NAME;
// console.log('URL:', URL);

app.get('/_/health', async (req, res, next) => {
  res.send('OK');
});

app.get('/', (req, res) => {
  console.log('get home page');
  res.status(200).render('index.ejs', { URL: URL });
});

// 1. Get client-ref from request and store it for later use.
app.get('/webhooks/delivery-receipt', (req, res) => {
  console.log(req.query);
  res.status(200).send('OK');
});

// 2. Get client-ref from mongodb and send it to prefered endpoint
app.get('/webhooks/inbound', (req, res) => {
  console.log(req.query);
  res.status(200).send('OK');
});

// 3. Route to where client-ref is sent.
app.post('/placeToSendClientRef', (req, res) => {
  console.log(req.body);
  res.status(200).send('OK');
});

app.get('/logout', (req, res) => {
  res.redirect('/');
});

app.get('/login', (req, res) => {
  console.log('/get login page');
  res.status(200).render('login.ejs', { message: 'Please Log in', URL: URL });
});

app.get('/authpage', verifyToken, (req, res) => {
  res.status(200).send('Get authpage 🙌').render('authpage.ejs', {
    messages: 'Get authpage 🙌',
    URL: URL,
  });
});

app.get('/register', (req, res) => {
  console.log('/get register page');
  res.status(200).render('register.ejs', {
    message: 'Please register to access Vonage Cloud Runtime',
    URL: URL,
  });
});
const { TOKEN_KEY } = JSON.parse(process.env['NERU_CONFIGURATIONS']);

app.post('/register', async (req, res) => {
  console.log('Trying to register user...', req.body);
  try {
    // Get user input.
    const { apiKey, apiSecret, email, role } = await req.body;
    // Validate user input.
    if (!(apiKey && apiSecret && email && role)) {
      // TO DO !!!!! RETURN TO LOGIN PAGE WITH MESSAGE
      res.status(400).send('All input is required');
    }

    // Validate if user exist in our database
    const apiKeyExists = await findOneEntry(apiKey, apiSecret);
    console.log('apiKeyExists', apiKeyExists);

    if (apiKeyExists) {
      // return res.status(200).send('User Already Exist. Please Login instead!');
      res
        .status(200)
        .render('login.ejs', { message: 'Please Log in', URL: URL });
    } else {
      console.log('User does not exists. Attempting to create user.');
      // Encrypt the user apiSecret.
      const encryptedPassword = await bcrypt.hash(apiSecret, 10);

      // Create a signed JWT token with both the apiKey and apiSecret
      const token = jwt.sign(
        {
          apiKey: apiKey,
          apiSecret: apiSecret,
        },
        // EXPRESS
        // process.env.TOKEN_KEY,
        // NERU
        TOKEN_KEY,
        {
          expiresIn: '2h',
        }
      );

      // Create a user in our database.
      const user = await insertEntry({
        apiKey,
        apiSecret: encryptedPassword,
        email: email.toLowerCase(),
        role: role.toLowerCase(), // TODO !!!!! DON'T LET EVERYONE CREATE ADMIN
        token: token,
      });

      // return new user
      // console.log('user:', user)
      // user:
      //   {
      //     "acknowledged": true,
      //     "insertedId": "62ee611195f60c5ed1326e0f"
      // }
      res
        .status(201)
        .render('login.ejs', { message: "You've successfully registered!" });
    }
  } catch (error) {
    console.error(error);
  }
});

// Our login logic goes here
app.post('/login', async (req, res) => {
  try {
    console.log('Trying to login user...', req.body);
    // Get user input.
    const { apiKey, apiSecret, email, role } = await req.body;
    // Validate user input.
    if (!(apiKey && apiSecret && email && role)) {
      res.status(400).send('All input is required');
    } else {
      // Validate if user exist in our database
      const apiKeyExists = await findOneEntry(apiKey, apiSecret);
      // console.log('apiKeyExists', apiKeyExists); // HASHED-API-SECRET
      // console.log('apiSecret', apiSecret);
      // console.log('Compare:', await bcrypt.compare(apiSecret, apiKeyExists)); // true

      // Compare input apiSecret to stored hash apiSecret
      if (
        apiKeyExists &&
        (await bcrypt.compare(apiSecret, apiKeyExists.apiSecret))
      ) {
        console.log('YES! User Exists!');

        const token = jwt.sign(
          {
            apiKey: apiKey,
            apiSecret: apiSecret,
          },
          TOKEN_KEY,
          {
            expiresIn: '2h',
          }
        );

        apiKeyExists.token = token;

        apiKeyExists.message = 'Your authorized to access this page!';

        res.status(200).render('authpage.ejs', apiKeyExists);
      } else {
        console.log('Invalid Credentials!');

        // res.status(400).send('Invalid Credentials!');
        res
          .status(200)
          .render('login.ejs', { message: 'Invalid Credentials!' });
      }
    }
  } catch (error) {
    console.log('Failed to login user', error);
    res.status(400).send('Failed to login user');
  }
});

app.listen(PORT, () => {
  console.log(`NERU on port ${PORT}`);
});
