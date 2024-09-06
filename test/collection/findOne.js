import { describe, it } from "node:test";
import assert from "node:assert";
import { hooksChain } from "./helpers.js";


export function defineFindOne() {
  describe("findOne", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.findOne", "args", ({ hookedCollection }) => hookedCollection.findOne());
      assert.deepEqual(result, undefined, "It inserted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.findOne.success", "result", ({ hookedCollection }) => hookedCollection.findOne());
      assert.deepEqual(result, "Hello World");
    });
  });
}
