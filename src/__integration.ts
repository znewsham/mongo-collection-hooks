import {
  MongoClient,
} from "mongodb";

import { HookedCollection, Events } from "../src/index.js";
import { HookedFindCursor } from "./hookedFindCursor2.js";

const client = new MongoClient(process.env.MONGO_URL as string, { connectTimeoutMS: 1000, serverSelectionTimeoutMS: 1000, directConnection: true });

const collection = new HookedCollection<{
  name: string,
  object: {
    inner: string,
    array: {
      inner: number
    }[]
  }
}>(client.db().collection("dummy"));
