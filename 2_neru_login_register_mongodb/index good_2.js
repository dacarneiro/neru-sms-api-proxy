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
  console.log('Debug');
} else {
  // https://api-us.vonage.com/v1/neru/i/neru-4f2ff535-neru-sms-api-proxy-dev/
  console.log('Deploy');
}

URL = process.env.ENDPOINT_URL_SCHEME + '/' + process.env.INSTANCE_SERVICE_NAME;
console.log('URL:', URL);

app.get('/_/health', async (req, res, next) => {
  res.send('OK');
});

// ROOT WORKING
app.get('/', (req, res) => {
  console.log('Hello from Express Server', req.body);
  res.status(200).render('index.ejs', { URL: URL });
});

app.get('/webhooks/inbound', (req, res) => {
  console.log(req.query.text);
  res.status(200).send('OK');
});

app.get('/webhooks/delivery-receipt', (req, res) => {
  console.log(req.body);
  res.status(200).send('OK');
});

// LOGOUT WORKING
app.get('/logout', (req, res) => {
  res.redirect('/');
});

// LOGIN WORKING
app.get('/login', (req, res) => {
  console.log('/login page', req.body);
  res.status(200).render('login.ejs', { message: 'Please Log in', URL: URL });
});

// AUTHPAGE WORKING
app.get('/authpage', verifyToken, (req, res) => {
  res.status(200).send('Welcome to the Matrix! 🙌').render('authpage.ejs', {
    messages: 'Welcome to the Matrix! 🙌',
    URL: URL,
  });
});

app.get('/register', (req, res) => {
  console.log('/login page', req.body);
  res.status(200).render('register.ejs', {
    message: 'Please register to access Vonage Cloud Runtime',
    URL: URL,
  });
});

app.post('/register', async (req, res) => {
  console.log('Trying to register user...');
  try {
    // Get user input.
    const { apiKey, apiSecret, email, role } = await req.body;
    // Validate user input.
    if (!(apiKey && apiSecret && email && role)) {
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
        process.env.TOKEN_KEY,
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
      res.status(201).render('login.ejs', user);
    }
  } catch (error) {
    console.error(error);
  }
});

// Our login logic goes here
app.post('/login', async (req, res) => {
  try {
    console.log('Trying to login user...');
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
          process.env.TOKEN_KEY,
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
