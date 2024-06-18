import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";


export function defineCount() {
  describe("count", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.count", "args", ({ hookedCollection }) => hookedCollection.count({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, 1, "Found it");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.count.success", "result", ({ hookedCollection }) => hookedCollection.count({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.count.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "count", () => { throw new Error("BAD CALL"); });
          return hookedCollection.count({});
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });
  });
}
