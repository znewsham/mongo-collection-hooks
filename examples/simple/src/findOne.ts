import { MongoClient } from "mongodb";
import { HookedCollection } from "mongo-collection-hooks";

const client = new MongoClient(process.env.MONGO_URL || "");

const collection = new HookedCollection(client.db().collection("dummy"));

collection.on("before.findOne", async ({
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

collection.on("after.findOne", async ({
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

collection.on("before.findOne*", async ({
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

collection.on("after.findOne*", async ({
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

collection.on("before.findOneAndDelete", async ({
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

collection.on("after.findOneAndDelete", async ({
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

collection.on("before.findOneAndReplace", async ({
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

collection.on("after.findOneAndReplace", async ({
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

collection.on("before.findOneAndUpdate", async ({
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

collection.on("after.findOneAndUpdate", async ({
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
