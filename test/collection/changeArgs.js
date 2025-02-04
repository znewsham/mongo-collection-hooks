import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection } from "./helpers.js";


export function defineChangeArgs() {
  describe("change args", async () => {
    [
      "find",
      "findOne",
      "updateOne",
      "updateMany",
      "insertOne",
      "insertMany",
      "deleteOne",
      "deleteMany",
      "distinct",
      "aggregate",
      "findOneAndUpdate",
      "findOneAndReplace",
      "findOneAndDelete",
      "replaceOne"
    ].forEach((name) => {
      it(`Should provide both the original and modified args to the after hooks for ${name}`, async () => {
        const { hookedCollection } = getHookedCollection();
        const beforeHook = mock.fn(({
          args,
          argsOrig
        }) => {
          assert.deepEqual(args, argsOrig);
          if (name === "distinct") {
            return ["", { a: 1 }];
          }
          else if (name === "insertMany") {
            return [[{ a: 1 }]];
          }
          return [{ a: 1 }];
        });
        const afterHook = mock.fn(({
          args,
          argsOrig
        }) => {
          assert.notDeepEqual(args, argsOrig);
          return [{}];
        });
        hookedCollection.on(`before.${name}`, beforeHook);
        hookedCollection.on(`after.${name}`, afterHook);
        const args = name === "distinct" ? ["", {}] : [{}];
        await hookedCollection[name](...args);
        assert.strictEqual(beforeHook.mock.callCount(), 1, "should have called the beforeHook");
        assert.strictEqual(afterHook.mock.callCount(), 1, "should have called the after hook");
      });
    });
  });
}
