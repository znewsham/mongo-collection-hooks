import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";
import { deleteTests } from "./delete.js";

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
    deleteTests("findOneAndDelete");
  });
}
