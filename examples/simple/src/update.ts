import { MongoClient } from "mongodb";
import { HookedCollection } from "mongo-collection-hooks";

const client = new MongoClient(process.env.MONGO_URL || "");

const collection = new HookedCollection(client.db().collection("dummy"));

collection.on("before.update", async ({
  args,
  argsOrig,
  caller,
  filterMutator: {
    filter,
    mutator,
    replacement
  },
  filterMutatorOrig: {
    filter: filterOrig,
    mutator: mutatorOrig,
    replacement: replacementOrig
  },
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, caller, filter, mutator, replacement, filterOrig, mutatorOrig, replacementOrig, invocationSymbol, parentInvocationSymbol, thisArg, missing);
  return {
    filter,
    mutator,
    replacement
  };
});

collection.on("after.update", async ({
  args,
  argsOrig,
  caller,
  filterMutator: {
    filter,
    mutator,
    replacement
  },
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  resultOrig,
  result,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(args, argsOrig, caller, filter, mutator, replacement, invocationSymbol, parentInvocationSymbol, thisArg, result, resultOrig, error, missing);
  return result;
}, {
  fetchPrevious: true,
  fetchPreviousProjection: { _id: 1 },
  projection: { _id: 1 },
  shouldRun: () => true
});

collection.on("before.updateOne", async ({
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

collection.on("after.updateOne", async ({
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

collection.on("before.updateMany", async ({
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

collection.on("after.updateMany", async ({
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

collection.on("before.replaceOne", async ({
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

collection.on("after.replaceOne", async ({
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
