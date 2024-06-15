import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";


export function defineEstimatedDocumentCount() {
  describe("estimatedDocumentCount", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.estimatedDocumentCount", "args", ({ hookedCollection }) => hookedCollection.estimatedDocumentCount(), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, 3, "It counted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.estimatedDocumentCount.success", "result", ({ hookedCollection }) => hookedCollection.estimatedDocumentCount());
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.estimatedDocumentCount.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "estimatedDocumentCount", () => { throw new Error("BAD CALL"); });
          return hookedCollection.estimatedDocumentCount();
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });
  });
}
