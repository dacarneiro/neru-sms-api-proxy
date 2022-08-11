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

export const deleteExpiredEntries = async () => {
  try {
    console.log('✅ Connecting to DB in deleteExpiredEntries...');
    await CLIENT.connect();
    const db = CLIENT.db(DB_NAME).collection(DB_COLLECTION);

    // IF ANY ENTRIES ARE EXPIRED DELETE THOSE ENTRIES
    const query = {
      date: { $lte: new Date().toISOString() },
    };

    const result = await db.deleteMany(query);
    console.log('✅ Deleted ' + result.deletedCount + ' documents');

    // RETURN TO INBOUND WEBHOOK
    return result;
  } catch (error) {
    console.log('🔥 Error connecting to mongodb:', error);
  } finally {
    await CLIENT.close();
  }
};

// NOT BEING USED
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

// IS USED WHEN INBOUND WEBHOOK RECEIVES A MESSAGE
export const findOneEntry = async ({ msisdn, to, apiKey }) => {
  try {
    console.log('✅ Connecting to DB in findOneEntry...');
    await CLIENT.connect();
    const db = CLIENT.db(DB_NAME).collection(DB_COLLECTION);

    const query = { msisdn, to, apiKey };

    const foundEntry = await db.findOne(query);

    // RETURN RESULT - WHETHER WE FOUND OR NOT
    return foundEntry;
  } catch (error) {
    console.log('🔥 Error connecting to mongodb:', error);
  } finally {
    await CLIENT.close();
  }
};

// USED WHEN DLR WEBHOOK IS HIT WHEN OUTGOING MESSAGE IS SENT
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
  date,
}) => {
  try {
    await CLIENT.connect();
    console.log('✅ Connecting to DB in insertEntry...');
    const db = CLIENT.db(DB_NAME).collection(DB_COLLECTION);

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
      date,
    };
    const result = await db.insertOne(doc);
    // result = { acknowledged: true, insertedId: '62f3fb3e06e45a59d5a44435' }
    console.log(`A document was inserted with the _id: ${result.insertedId}`);

    // IF INSERTED
    return true;
  } catch (error) {
    // IF NOT INSERTED
    console.log('🔥', error);
    return false;
  } finally {
    await CLIENT.close();
  }
};
