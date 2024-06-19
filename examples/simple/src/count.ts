import { MongoClient } from "mongodb";
import { HookedCollection } from "mongo-collection-hooks";

const client = new MongoClient(process.env.MONGO_URL || "");

const collection = new HookedCollection(client.db().collection("dummy"));

collection.on("before.count", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, thisArg, missing);
  return args;
});

collection.on("after.count", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  resultOrig,
  error,
  result,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, thisArg, result, resultOrig, error, missing);
  return result;
});

collection.on("before.count*", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  operation,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, operation, invocationSymbol, thisArg, missing);
  return args;
});

collection.on("after.count*", async ({
  args,
  invocationSymbol,
  thisArg,
  resultOrig,
  error,
  result,
  operation,
  // @ts-expect-error
  missing
}) => {
  console.log(args, operation, invocationSymbol, thisArg, result, resultOrig, error, missing);
  return result;
});

collection.on("before.estimatedDocumentCount", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, thisArg, missing);
  return args;
});

collection.on("after.estimatedDocumentCount", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  resultOrig,
  error,
  result,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, thisArg, result, resultOrig, error, missing);
  return result;
});

collection.on("before.countDocuments", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, thisArg, missing);
  return args;
});

collection.on("after.countDocuments", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  resultOrig,
  error,
  result,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, thisArg, result, resultOrig, error, missing);
  return result;
});

type x = Promise<number | void>

async function y(): x {
  return undefined;
}
