import {
  MongoClient,
} from "mongodb";

import { HookedCollection, Events } from "../src/index.js";

const client = new MongoClient(process.env.MONGO_URL, { connectTimeoutMS: 1000, serverSelectionTimeoutMS: 1000, directConnection: true });

const collection = new HookedCollection<{
  name: string,
  object: {
    inner: string,
    array: {
      inner: number
    }[]
  }
}>(client, "dummy");

collection.on("before.delete", ({
  args,
  argsOrig,
  _id
}) => {
  return 3;
});
