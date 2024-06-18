import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";


export function defineCountDocuments() {
  describe("countDocuments", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.countDocuments", "args", ({ hookedCollection }) => hookedCollection.countDocuments({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, 1, "Found it");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.countDocuments.success", "result", ({ hookedCollection }) => hookedCollection.countDocuments({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.countDocuments.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "countDocuments", () => { throw new Error("BAD CALL"); });
          return hookedCollection.countDocuments({});
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });
  });
}
