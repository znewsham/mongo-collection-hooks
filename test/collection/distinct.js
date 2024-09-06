import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { hooksChain } from "./helpers.js";


export function defineDistinct() {
  describe("distinct", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.distinct", "args", ({ hookedCollection }) => hookedCollection.distinct("_id"));
      assert.deepEqual(result, [], "It inserted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.distinct.success", "result", ({ hookedCollection }) => hookedCollection.distinct("_id"));
      assert.deepEqual(result, "Hello World");
    });
  });
}