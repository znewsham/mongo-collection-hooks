import { MongoClient } from "mongodb";
import { HookedCollection } from "mongo-collection-hooks";

const client = new MongoClient(process.env.MONGO_URL || "");

const collection = new HookedCollection(client.db().collection("dummy"));

collection.on("before.insert", async ({
  args,
  argsOrig,
  caller,
  doc,
  docOrig,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, caller, doc, docOrig, invocationSymbol, parentInvocationSymbol, thisArg, missing);
  return doc;
});

collection.on("after.insert", async ({
  args,
  argsOrig,
  invocationSymbol,
  resultOrig,
  thisArg,
  error,
  result,
  doc,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, resultOrig, thisArg, error, result, doc, missing);
  return result;
});

collection.on("before.insertOne", async ({
  args,
  argsOrig,
  thisArg,
  invocationSymbol,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, thisArg, invocationSymbol, missing);
  return args;
});

collection.on("after.insertOne", async ({
  args,
  argsOrig,
  invocationSymbol,
  resultOrig,
  thisArg,
  error,
  result,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, resultOrig, thisArg, error, result, missing);
  return result;
});

collection.on("before.insertMany", async ({
  args,
  argsOrig,
  thisArg,
  invocationSymbol,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, thisArg, invocationSymbol, missing);
  return args;
});

collection.on("after.insertMany", async ({
  args,
  argsOrig,
  invocationSymbol,
  resultOrig,
  thisArg,
  error,
  result,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, resultOrig, thisArg, error, result, missing);
  return result;
});

