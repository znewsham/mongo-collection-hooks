import { MongoClient } from "mongodb";
import { HookedCollection } from "mongo-collection-hooks";

const client = new MongoClient(process.env.MONGO_URL || "");

const collection = new HookedCollection(client.db().collection("dummy"));

collection.on("before.find", ({
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
  "before.find",
  // @ts-expect-error
  async () => {}
);

collection.on("after.find", ({
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
  "after.find",
  // @ts-expect-error
  async () => {}
);

collection.on("before.find.cursor.asyncIterator", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg);
});

collection.on("after.find.cursor.asyncIterator", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, error, missing);
});

collection.on("before.find.cursor.close", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.find.cursor.close", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});

collection.on("before.find.cursor.count", async ({
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

collection.on("after.find.cursor.count", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  result,
  resultOrig,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, result, resultOrig, error, missing);
});

collection.on("before.find.cursor.forEach", async ({
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

collection.on("after.find.cursor.forEach", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});

collection.on("before.find.cursor.toArray", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.find.cursor.toArray", async ({
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

collection.on("before.find.cursor.next", async ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.find.cursor.next", async ({
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

collection.on("before.find.cursor.execute", async ({
  caller,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(caller, invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.find.cursor.execute", async ({
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

collection.on("before.find.cursor.rewind", ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.find.cursor.rewind", ({
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});
