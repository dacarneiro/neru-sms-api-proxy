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

// FIND ALL LISTINGS
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
        console.log(`index: ${i} email: ${result.email}`);
      });
    }
  } catch (error) {
    console.log('🔥', error);
  }
};

export const findOneEntry = async (api_key, api_secret) => {
  try {
    console.log('Connected to DB...');
    await CLIENT.connect();

    const database = CLIENT.db(DB_NAME);
    const accounts = database.collection(DB_COLLECTION);

    const cursor = CLIENT.db(DB_NAME).collection(DB_COLLECTION).find();

    // console.log('Showing all accounts...');
    const results = await cursor.toArray();

    // const query = { apiKey: api_key, apiSecret: api_secret };
    const query = { apiKey: api_key };

    // const options = {
    //   projection: {
    //     apiKey: 1,
    //     apiSecret: 1,
    //   },
    // };
    const account = await accounts.findOne(query);
    if (account) {
      console.log('Found your account:', account);
      // console.log('Bycrypt:', account.apiSecret);
      return account; // RETURN HASHED API-SECRET
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

export const insertEntry = async ({
  apiKey,
  apiSecret,
  email,
  role,
  token,
}) => {
  try {
    await CLIENT.connect();
    console.log('Connected to DB...');

    const database = CLIENT.db(DB_NAME);
    const collection = database.collection(DB_COLLECTION);

    // create a document to insert
    const doc = {
      apiKey: apiKey,
      apiSecret: apiSecret,
      email: email,
      role: role,
      token: token,
    };
    const result = await collection.insertOne(doc);
    console.log(`A document was inserted with the _id: ${result.insertedId}`);
    return result;
  } catch (error) {
    console.log('🔥', error);
  } finally {
    await CLIENT.close();
  }
};

export const setURL = async () => {
  try {
    // set URL logic here
  } catch (error) {
    console.log('🔥 ERROR', error);
  }
};
