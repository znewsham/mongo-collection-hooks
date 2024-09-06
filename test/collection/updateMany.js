import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hooksChain } from "./helpers.js";


export function defineUpdateMany() {
  describe("updateMany", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.updateMany", "args", ({ hookedCollection }) => hookedCollection.updateMany({ _id: "test" }), [[[{ _id: "test" }]], [[{ _id: "test" }]]]);
      assert.deepEqual(result.acknowledged, true, "It updated");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.updateMany.success", "result", ({ hookedCollection }) => hookedCollection.updateMany({ _id: "test" }));
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

      await hookedCollection.updateMany(
        { _id: "test" },
        { $setOnInsert: { _id: "test", field: "someField" } },
        { upsert: true }
      );
      assert.strictEqual(insertMock.mock.callCount(), 2, "We called the insert hook once");
      assert.strictEqual(updateMock.mock.callCount(), 0, "we didn't call the update hook");
    });

    it("should call update hooks once per document", async () => {
      const { hookedCollection } = getHookedCollection([]);
      const updateMock = mock.fn(() => {});
      await hookedCollection.insertOne({ _id: "test" });
      await hookedCollection.insertOne({ _id: "test1" });
      hookedCollection.on("before.update", updateMock);
      hookedCollection.on("after.update.success", updateMock);
      await hookedCollection.updateMany({}, { $set: { thing: 1 } });
      assert.strictEqual(updateMock.mock.callCount(), 4, "we didn't call the update hook");
    });
  });
}
