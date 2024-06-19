import { MongoClient } from "mongodb";
import { HookedCollection } from "mongo-collection-hooks";

const client = new MongoClient(process.env.MONGO_URL || "");

const collection = new HookedCollection(client.db().collection("dummy"));

collection.on("before.cursor.asyncIterator", async ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg);
});

collection.on("after.cursor.asyncIterator", async ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, error, missing);
});

collection.on("before.cursor.close", async ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.cursor.close", async ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});

collection.on("before.cursor.forEach", async ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  args,
  argsOrig,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, args, argsOrig, missing);
});

collection.on("after.cursor.forEach", async ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});

collection.on("before.cursor.toArray", async ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.cursor.toArray", async ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  result,
  resultOrig,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, result, resultOrig, missing, error);
});

collection.on("before.cursor.next", async ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.cursor.next", async ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  result,
  resultOrig,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, result, resultOrig, missing, error);
});

collection.on("before.cursor.execute", async ({
  operation,
  caller,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, caller, invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.cursor.execute", async ({
  operation,
  caller,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, caller, invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});

collection.on("before.cursor.rewind", ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, missing);
});

collection.on("after.cursor.rewind", ({
  operation,
  invocationSymbol,
  parentInvocationSymbol,
  thisArg,
  error,
  // @ts-expect-error
  missing
}) => {
  console.log(operation, invocationSymbol, parentInvocationSymbol, thisArg, missing, error);
});
