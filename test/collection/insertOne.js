import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { hooksChain } from "./helpers.js";


export function defineInsertOne() {
  describe("insertOne", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.insertOne", "args", ({ hookedCollection }) => hookedCollection.insertOne({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, { acknowledged: true, insertedId: "test" }, "It inserted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.insertOne.success", "result", ({ hookedCollection }) => hookedCollection.insertOne({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });
  });
}
