import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";
import { updateTests } from "./update.js";
import { Test } from "../testClass.js";

export function defineFindOneAndUpdate() {
  describe("findOneAndUpdate", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.findOneAndUpdate", "args", ({ hookedCollection }) => hookedCollection.findOneAndUpdate({ _id: "test" }, { $set: { value: "test" } }), [[{ _id: "test" }, { $set: { value: "test" } }], [{ _id: "test" }, { $set: { value: "test" } }]]);
      // TODO: test only problem - does it return the updated value or the old one?
      assert.deepEqual(result, { ok: 1, value: { _id: "test", value: 1 } }, "It updated");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.findOneAndUpdate.success", "result", ({ hookedCollection }) => hookedCollection.findOneAndUpdate({ _id: "test" }, { $set: { value: "test" } }));
      assert.deepEqual(result, "Hello World");
    });

    it("should respect the includeMetadata=true option even with after hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("after.update", ({
        result
      }) => result);
      const result = await hookedCollection.findOneAndUpdate({ _id: "test" }, { $set: { a: 1 } }, { includeResultMetadata: true });
      assert.deepEqual(result, { ok: 1, value: { _id: "test" } });
    });

    it("should respect the includeMetadata=false option even with after hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("after.update", ({
        result
      }) => result);
      const result = await hookedCollection.findOneAndUpdate({ _id: "test" }, { $set: { a: 1 } }, { includeResultMetadata: false });
      assert.deepEqual(result, { _id: "test" });
    });

    it("the transform should work", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }], { transform: doc => new Test(doc) });
      hookedCollection.on("after.findOneAndUpdate", ({
        result
      }) => {
        assert.ok(result.value instanceof Test, "transformed in hook");
      });
      const result = await hookedCollection.findOneAndUpdate({}, { $set: { a: 1 } });

      assert.ok(result.value instanceof Test, "transform worked");
    });

    updateTests("findOneAndUpdate");
  });
}
