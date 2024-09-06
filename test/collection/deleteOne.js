import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { hooksChain } from "./helpers.js";


export function defineDeleteOne() {
  describe("deleteOne", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.deleteOne", "args", ({ hookedCollection }) => hookedCollection.deleteOne({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, { acknowledged: true, deletedCount: 0 }, "It deleted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.deleteOne.success", "result", ({ hookedCollection }) => hookedCollection.deleteOne({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });
  });
}
