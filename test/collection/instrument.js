import { HookedCollection } from "mongo-collection-hooks";
import { after, before, describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection } from "./helpers.js";

export function defineInstrument() {
  const functionsToInstrument = [
    { name: "insertOne", args: [{}] },
    { name: "insertMany", args: [[{}]] },
    { name: "updateOne", args: [{}, { $set: {} }] },
    { name: "updateMany", args: [{}, { $set: {} }] },
    { name: "deleteOne", args: [{}] },
    { name: "deleteMany", args: [{}] },
    { name: "findOneAndUpdate", args: [{}, { $set: {} }], fn: () => ({}) },
    { name: "findOneAndReplace", args: [{}, {}], fn: () => ({}) },
    { name: "findOneAndDelete", args: [{}], fn: () => ({}) },
    { name: "findOne", args: [{}] },
    { name: "aggregate", args: [{}] },
    { name: "find", args: [{}] }
  ];
  describe("instrument", () => {
    functionsToInstrument.forEach(({ name, args, fn }) => {
      it(`should patch the collection correctly for ${name}`, async () => {
        const collection = getHookedCollection();
        const instrumentedCollection = {
          [name]: mock.fn(fn)
        };
        collection.hookedCollection._setCollection(instrumentedCollection);
        await collection.hookedCollection[name](...args);
        assert.equal(instrumentedCollection[name].mock.callCount(), 1, "the instrumented function was called");
      });
    });
  });

  describe("instrumentConstroctor", () => {
    const instrumentedCollection = Object.fromEntries(functionsToInstrument.map(({ name, fn }) => [name, mock.fn(fn)]));
    const mockedInit = mock.fn(function mocked() {
      this._setCollection(instrumentedCollection);
    });
    const oldInit = HookedCollection.prototype.init;
    before(() => {
      HookedCollection.prototype.init = mockedInit;
    });

    after(() => {
      HookedCollection.prototype.init = oldInit;
    });

    functionsToInstrument.forEach(({ name, args }) => {
      it(`should patch all new collections correctly for ${name}`, async () => {
        const collection = getHookedCollection();
        await collection.hookedCollection[name](...args);
        assert.equal(instrumentedCollection[name].mock.callCount(), 1, "the instrumented function was called");
      });
    });
  });
}
