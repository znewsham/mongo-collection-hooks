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
  _id,
  getDocument,
  // @ts-expect-error
  missing
}) => {
  console.log(args, _id, getDocument, argsOrig, caller, filter, filterOrig, invocationSymbol, parentInvocationSymbol, thisArg, missing);
  return args;
}, {
  projection() {
    return { a: 1 };
  }
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
  previousDocument,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, previousDocument, caller, filter, invocationSymbol, parentInvocationSymbol, thisArg, result, resultOrig, error, missing);
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
  _id,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, _id, invocationSymbol, thisArg, missing);
  return args;
});

collection.on("after.deleteOne", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  resultOrig,
  result,
  _id,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, _id, invocationSymbol, thisArg, result, resultOrig, missing);
  return result;
});

collection.on("before.deleteMany", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  _ids,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, _ids, invocationSymbol, thisArg, missing);
  return args;
});

collection.on("after.deleteMany", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  resultOrig,
  result,
  _ids,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, _ids, invocationSymbol, thisArg, result, resultOrig, missing);
  return result;
});
