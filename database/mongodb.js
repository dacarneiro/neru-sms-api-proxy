import axios from 'axios';
import { MongoClient, ServerApiVersion } from 'mongodb';

// NERU
const { MONGO_DB_PASSWORD, DB_NAME, DB_COLLECTION } = JSON.parse(
  process.env['NERU_CONFIGURATIONS']
);

// EXPRESS
// const { MONGO_DB_PASSWORD, DB_NAME, DB_COLLECTION } = process.env;
// console.log('MONGO_DB_PASSWORD', MONGO_DB_PASSWORD);
// console.log('DB_NAME', DB_NAME);
// console.log('DB_COLLECTION', DB_COLLECTION);

const MONGO_URI = `mongodb+srv://admin:${MONGO_DB_PASSWORD}@cluster0.4si2p.mongodb.net/${DB_NAME}?retryWrites=true&w=majority`;
// console.log('MONGO_URL', MONGO_URI);

const CLIENT = new MongoClient(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

export const connectDB = async () => {
  try {
    console.log('Connected to DB...');
    await CLIENT.connect();

    // DO DB STUFF HERE...
    // await findAllEntries(DB_NAME, DB_COLLECTION, CLIENT, 5);
    // await findOneEntry(DB_NAME, DB_COLLECTION, API_KEY, API_SECRET, CLIENT);
  } finally {
    await CLIENT.close();
  }
};

// TO DO
export const findAllEntries = async (
  dbName,
  dbCollection,
  client,
  resultsLimit
) => {
  try {
    console.log('Trying to find All Entries...');
    const cursor = client
      .db(dbName)
      .collection(dbCollection)
      .find()
      .limit(resultsLimit);

    const results = await cursor.toArray();
    console.log(`Found ${results.length} entry.`);
    console.log('results:', results);

    if (results.length > 0) {
      results.forEach((result, i) => {
        console.log(`index: ${i} api-key: ${result['api-key']}`);
      });
    }
  } catch (error) {
    console.log('🔥', error);
  }
};

// TO DO
export const findOneEntry = async ({ msisdn, to, apiKey }) => {
  try {
    console.log('Connected to DB...');
    await CLIENT.connect();
    console.log('PARAMS:', msisdn, to, apiKey);

    const database = CLIENT.db(DB_NAME);
    const accounts = database.collection(DB_COLLECTION);

    const cursor = CLIENT.db(DB_NAME).collection(DB_COLLECTION).find();

    // console.log('Showing all accounts...');
    const results = await cursor.toArray();

    // const query = { apiKey: api_key, apiSecret: api_secret };
    const query = { msisdn, to, apiKey };

    // const options = {
    //   projection: {
    //     apiKey: 1,
    //     apiSecret: 1,
    //   },
    // };
    const account = await accounts.findOne(query);
    if (account) {
      console.log('Found query match!');
      // console.log('Found your account:', account);
      // ADD CLIENT-REF
      // let newPayload = {
      //   msisdn: account.msisdn,
      //   to: account.to,
      //   messageId: account.messageId,
      //   'api-key': account.apiKey,
      //   'client-ref': account.clientRef,
      // };

      return account;
    } else {
      console.log('Account does not exist!', account);
      return false; // null
    }
  } catch (error) {
    console.log('🔥 Error connecting to mongodb:', error);
  } finally {
    await CLIENT.close();
  }
};

// TODO
export const insertEntry = async ({
  msisdn,
  to,
  networkCode,
  messageId,
  price,
  status,
  scts,
  errCode,
  clientRef,
  apiKey,
  messageTimestamp,
}) => {
  try {
    await CLIENT.connect();
    console.log('Connected to DB...');

    const database = CLIENT.db(DB_NAME);
    const collection = database.collection(DB_COLLECTION);

    // create a document to insert
    const doc = {
      msisdn,
      to,
      networkCode,
      messageId,
      price,
      status,
      scts,
      errCode,
      clientRef,
      apiKey,
      messageTimestamp,
    };
    const result = await collection.insertOne(doc);
    // result = { acknowledged: true, insertedId: '62f3fb3e06e45a59d5a44435' }
    console.log(`A document was inserted with the _id: ${result.insertedId}`);

    // If inserted
    return true;
  } catch (error) {
    // If not inserted
    console.log('🔥', error);
  } finally {
    await CLIENT.close();
  }
};
