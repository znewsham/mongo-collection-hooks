import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";
import { updateTests } from "./update.js";
import { Test } from "../testClass.js";

export function defineFindOneAndReplace() {
  describe("findOneAndReplace", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.findOneAndReplace", "args", ({ hookedCollection }) => hookedCollection.findOneAndReplace({ _id: "test" }, { value: "test" }), [[{ _id: "test" }, { value: "test" }], [{ _id: "test" }, { value: "test" }]]);
      // TODO: test only problem - does it return the updated value or the old one?
      assert.deepEqual(result, { ok: 1, value: { _id: "test", value: 1 } }, "It updated");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.findOneAndReplace.success", "result", ({ hookedCollection }) => hookedCollection.findOneAndReplace({ _id: "test" }, { value: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should respect the includeMetadata=true option even with after hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("after.update", ({
        result
      }) => result);
      const result = await hookedCollection.findOneAndReplace({ _id: "test" }, { a: 1 }, { includeResultMetadata: true });
      assert.deepEqual(result, { ok: 1, value: { _id: "test" } });
    });

    it("should respect the includeMetadata=false option even with after hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("after.update", ({
        result
      }) => result);
      const result = await hookedCollection.findOneAndReplace({ _id: "test" }, { a: 1 }, { includeResultMetadata: false });
      assert.deepEqual(result, { _id: "test" });
    });

    it("the transform should work", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }], { transform: doc => new Test(doc) });
      hookedCollection.on("after.findOneAndReplace", ({
        result
      }) => {
        assert.ok(result.value instanceof Test, "transformed in hook");
      });
      const result = await hookedCollection.findOneAndReplace({}, { a: 1 });

      assert.ok(result.value instanceof Test, "transform worked");
    });
    
    it("should use chained options instead of original options", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      const mockFindOneAndReplace = mock.method(fakeCollection, "findOneAndReplace");
      
      hookedCollection.on("before.findOneAndReplace", ({ args }) => {
        const [filter, replacement, options] = args;
        return [filter, replacement, { ...options, comment: "modified options" }];
      });

      const filter = { _id: "test" };
      const replacement = { _id: "test", field: "value" };
      const originalOptions = { comment: "original options" };
      await hookedCollection.findOneAndReplace(filter, replacement, originalOptions);
      
      assert.strictEqual(mockFindOneAndReplace.mock.calls.length, 1);
      const passedOptions = mockFindOneAndReplace.mock.calls[0].arguments[2];
      assert.deepEqual(passedOptions, { comment: "modified options" });
    });

    updateTests("findOneAndReplace");
  });
}
