import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hooksChain } from "./helpers.js";


export function defineReplaceOne() {
  describe("replaceOne", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.replaceOne", "args", ({ hookedCollection }) => hookedCollection.replaceOne({ _id: "test" }, { thing: "hello" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result.acknowledged, true, "It updated");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.replaceOne.success", "result", ({ hookedCollection }) => hookedCollection.replaceOne({ _id: "test" }, { thing: "hello" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should call insert hooks when a document is upserted", async () => {
      const { hookedCollection } = getHookedCollection([]);
      const insertMock = mock.fn(() => {});
      const updateMock = mock.fn(() => {});
      hookedCollection.on("before.insert", insertMock);
      hookedCollection.on("after.insert.success", insertMock);
      hookedCollection.on("after.insert.error", insertMock);
      hookedCollection.on("before.update", updateMock);
      hookedCollection.on("after.update.success", updateMock);
      hookedCollection.on("after.update.error", updateMock);

      await hookedCollection.replaceOne(
        { _id: "test" },
        { _id: "test", thing: "hello" },
        { upsert: true }
      );
      assert.strictEqual(insertMock.mock.callCount(), 2, "We called the insert hook once");
      assert.strictEqual(updateMock.mock.callCount(), 0, "we didn't call the update hook");
    });
  });
}
