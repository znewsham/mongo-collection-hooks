import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { hooksChain } from "./helpers.js";


export function defineInsertMany() {
  describe("insertMany", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain(
        "before.insertMany",
        "args",
        ({ hookedCollection }) => hookedCollection.insertMany([{ _id: "test" }, { _id: "test2" }]),
        [[[{ _id: "test" }, { _id: "test2" }]], [[{ _id: "test" }, { _id: "test2" }]]]
      );
      assert.deepEqual(result, { acknowledged: true, insertedCount: 2, insertedIds: { 0: "test", 1: "test2" } }, "It inserted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.insertMany.success", "result", ({ hookedCollection }) => hookedCollection.insertMany([{ _id: "test" }]));
      assert.deepEqual(result, "Hello World");
    });
  });
}
