import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { deleteTests } from "./delete.js";


export function defineDeleteOne() {
  describe("deleteOne", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.deleteOne", "args", ({ hookedCollection }) => hookedCollection.deleteOne({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, { acknowledged: true, deletedCount: 1 }, "It deleted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.deleteOne.success", "result", ({ hookedCollection }) => hookedCollection.deleteOne({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.deleteOne.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "deleteOne", () => { throw new Error("BAD CALL"); });
          return hookedCollection.deleteOne({});
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });

    deleteTests("deleteOne");
  });
}
