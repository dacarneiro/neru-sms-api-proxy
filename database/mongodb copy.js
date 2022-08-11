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

const addHours = (numOfHours, date = new Date()) => {
  date.setTime(date.getTime() + numOfHours * 60 * 60 * 1000);
  return date;
};

const isAfter = (date1, date2) => {
  return date1 > date2;
};

// 👇️ Add 24 hours to a date
// const date = new Date('2022-03-14T09:25:30.820Z');
// console.log(addHours(24, date));

// Delete entries after 24 hours
const deleteOldEntries = async () => {
  try {
    console.log('Connected to DB...deleteOldEntries');
    await CLIENT.connect();

    console.log('Trying to find All Entries...');
    const cursor = CLIENT.db(DB_NAME).collection(DB_COLLECTION).find();
    const results = await cursor.toArray();
    if (results.length > 0) {
      results.forEach((result, i) => {
        console.log(`index: ${i} date: ${result['date']}`);

        // IF DATE IS EQUAL OR GREATER THAN 24 DELETE THE DOC
        // 1st add 24 hrs
        const date = new Date(result['date']);
        const datePlus24 = addHours(1, date);
        const currentDate = new Date();
        console.log('isAfter:', isAfter(currentDate, datePlus24));

        if (isAfter(currentDate, datePlus24) == true) {
          // DELETE DOC AND SEND WITHOUT CLIENT-REF
          console.log('TRUE');
          const accounts = CLIENT.db(DB_NAME).collection(DB_COLLECTION);
          accounts.deleteOne({ date: result['date'] });
        } else {
          // DONT DELETE AND SEND WITH CLIENT-REF
          console.log('FALSE');
        }

        // https://www.thecodebuzz.com/mongodb-date-range-query-greater-than-less-than/
        // const query = {
        //   date: { $gt: ISODate(currentDate) },
        // };

        // const result = await docs.deleteMany(query);
        // console.log("Deleted " + result.deletedCount + " documents");
      });
    }
  } catch (error) {
    console.log('🔥 Error connecting to mongodb:', error);
  } finally {
    await CLIENT.close();
  }
};

deleteOldEntries();

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
  date,
}) => {
  try {
    await CLIENT.connect();
    console.log('Connected to DB...');

    console.log('date', date);

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
      date,
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
