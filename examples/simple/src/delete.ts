import { MongoClient } from "mongodb";
import { HookedCollection } from "mongo-collection-hooks";

const client = new MongoClient(process.env.MONGO_URL || "");

const collection = new HookedCollection(client.db().collection("dummy"));

collection.on("before.delete", async ({
  args,
  argsOrig,
  caller,
  filter,
  filterOrig,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, caller, filter, filterOrig, invocationSymbol, parentInvocationSymbol, thisArg, missing);
  return args;
});

collection.on("after.delete", async ({
  args,
  argsOrig,
  caller,
  filter,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  resultOrig,
  result,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, caller, filter, invocationSymbol, parentInvocationSymbol, thisArg, result, resultOrig, error, missing);
  return result;
}, {
  fetchPrevious: true,
  fetchPreviousProjection: { _id: 1 },
  shouldRun: () => true
});

collection.on("before.deleteOne", async ({
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

collection.on("after.deleteOne", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  resultOrig,
  result,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, thisArg, result, resultOrig, missing);
  return result;
});

collection.on("before.deleteMany", async ({
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

collection.on("after.deleteMany", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  resultOrig,
  result,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, invocationSymbol, thisArg, result, resultOrig, missing);
  return result;
});
