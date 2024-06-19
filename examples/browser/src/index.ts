import { HookedCollection } from "mongo-collection-hooks";
import { LocalStorageCollection } from "./localStorageCollection.js";


const rawCollection = new LocalStorageCollection("testDB", "users");

// @ts-expect-error
const collection = new HookedCollection<{ _id: string }>(rawCollection);

async function main() {
  await collection.drop();
  collection.on("before.insert", ({
    args
  }) => {
    document.writeln("before insert... ", JSON.stringify(args), "<br />");
  });
  collection.on("after.insert", ({
    result,
    error
  }) => {
    document.writeln("after insert...", JSON.stringify(error), JSON.stringify(result), "<br />");
  });
  await collection.insertOne({
    _id: "Hello World"
  });
  document.writeln("Inserted!<br />");
}

main();
