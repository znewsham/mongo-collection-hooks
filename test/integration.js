import {
  MongoClient,
} from "mongodb";

import { HookedCollection, Events } from "../lib/index.js";

const client = new MongoClient(process.env.MONGO_URL, { connectTimeoutMS: 1000, serverSelectionTimeoutMS: 1000, directConnection: true });

const collection = new HookedCollection(client, "dummy");

async function init() {
  await client.connect();
  await collection.deleteMany({});
  collection.on("before.insertOne", async ({
    args,
    caller,
    doc,
  }) => {
    console.log(doc);
    return { ...doc, test2: "hello" };
  });
  await collection.insertMany([
    { _id: "test", accountId: "test" },
    { _id: "test2", accountId: "test" }
  ]);
  await collection.insertOne({ _id: "test3", accountId: "test" });
  await collection.updateOne({_id: "test"}, { $set: {object: {} } });
  collection.on("before.insertOne", ({
    args,
    argsOrig,
    invocationSymbol,
    thisArg
  }) => {

  })
  collection.on("after.cursor.next", ({
    result,
  }) => {
    if (!result) {
      return result;
    }
    return { ...result, hello: "world" }
  });
  console.log(await collection.find({}).toArray());
  await client.close();
}

init();
