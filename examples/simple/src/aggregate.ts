import { MongoClient } from "mongodb";
import { HookedCollection } from "mongo-collection-hooks";

const client = new MongoClient(process.env.MONGO_URL || "");

const collection = new HookedCollection(client.db().collection("dummy"));

collection.on("before.aggregate", ({
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

collection.on(
  "before.aggregate",
  // @ts-expect-error
  async () => {}
);

collection.on("after.aggregate", ({
  args,
  invocationSymbol,
  resultOrig,
  result,
  error,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  if (result) {
    result.close();
  }
  console.log(args, invocationSymbol, thisArg, missing, result, resultOrig, error);
  return result;
});

collection.on(
  "after.aggregate",
  // @ts-expect-error
  async () => {}
);

collection.on("before.aggregation.cursor.asyncIterator", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg);
});

collection.on("after.aggregation.cursor.asyncIterator", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, error, missing);
});

collection.on("before.aggregation.cursor.close", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.aggregation.cursor.close", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});

collection.on("before.aggregation.cursor.forEach", async ({
  invocationSymbol,
  parentInvocationSymbol,
  args,
  argsOrig,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, args, argsOrig, missing);
});

collection.on("after.aggregation.cursor.forEach", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});

collection.on("before.aggregation.cursor.toArray", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.aggregation.cursor.toArray", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  result,
  resultOrig,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, result, resultOrig, missing, error);
});

collection.on("before.aggregation.cursor.next", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.aggregation.cursor.next", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  result,
  resultOrig,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, result, resultOrig, missing, error);
});

collection.on("before.aggregation.cursor.execute", async ({
  caller,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(caller, invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.aggregation.cursor.execute", async ({
  caller,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(caller, invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});

collection.on("before.aggregation.cursor.rewind", ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.aggregation.cursor.rewind", ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});
