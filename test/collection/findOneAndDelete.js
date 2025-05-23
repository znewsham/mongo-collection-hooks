import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";
import { deleteTests } from "./delete.js";
import { Test } from "../testClass.js";

export function defineFindOneAndDelete() {
  describe("findOneAndDelete", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.findOneAndDelete", "args", ({ hookedCollection }) => hookedCollection.findOneAndDelete({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      // TODO: test only problem - does it return the updated value or the old one?
      assert.deepEqual(result, { ok: 1, value: { _id: "test", value: 1 } }, "It updated");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.findOneAndDelete.success", "result", ({ hookedCollection }) => hookedCollection.findOneAndDelete({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should respect the includeMetadata=true option even with after hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("after.delete", ({
        result
      }) => result);
      const result = await hookedCollection.findOneAndDelete({ _id: "test" }, { includeResultMetadata: true });
      assert.deepEqual(result, { ok: 1, value: { _id: "test" } });
    });

    it("should respect the includeMetadata=false option even with after hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("after.delete", ({
        result
      }) => result);
      const result = await hookedCollection.findOneAndDelete({ _id: "test" }, { includeResultMetadata: false });
      assert.deepEqual(result, { _id: "test" });
    });

    it("the transform should work", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }], { transform: doc => new Test(doc) });
      hookedCollection.on("after.findOneAndDelete", ({
        result
      }) => {
        assert.ok(result.value instanceof Test, "transformed in hook");
      });
      const result = await hookedCollection.findOneAndDelete({});

      assert.ok(result.value instanceof Test, "transform worked");
    });
    
    it("should use chained options instead of original options", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      const mockFindOneAndDelete = mock.method(fakeCollection, "findOneAndDelete");
      
      hookedCollection.on("before.findOneAndDelete", ({ args }) => {
        const [filter, options] = args;
        return [filter, { ...options, comment: "modified options" }];
      });

      const filter = { _id: "test" };
      const originalOptions = { comment: "original options" };
      await hookedCollection.findOneAndDelete(filter, originalOptions);
      
      assert.strictEqual(mockFindOneAndDelete.mock.calls.length, 1);
      const passedOptions = mockFindOneAndDelete.mock.calls[0].arguments[1];
      assert.deepEqual(passedOptions, { comment: "modified options" });
    });
    
    deleteTests("findOneAndDelete");
  });
}
