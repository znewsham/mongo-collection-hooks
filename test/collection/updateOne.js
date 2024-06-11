import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hooksChain } from "./helpers.js";


export function defineUpdateOne() {
  describe("updateOne", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.updateOne", "args", ({ hookedCollection }) => hookedCollection.updateOne({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result.acknowledged, true, "It updated");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.updateOne.success", "result", ({ hookedCollection }) => hookedCollection.updateOne({ _id: "test" }));
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

      await hookedCollection.updateOne(
        { _id: "test" },
        { $setOnInsert: { _id: "test", field: "someField" } },
        { upsert: true }
      );
      assert.strictEqual(insertMock.mock.callCount(), 2, "We called the insert hook once");
      assert.strictEqual(updateMock.mock.callCount(), 0, "we didn't call the update hook");
    });

    it("should allow access to the doc inside the hook", async () => {
      const { hookedCollection } = getHookedCollection([]);
      await hookedCollection.insertOne({ _id: "test" });
      await hookedCollection.insertOne({ _id: "test1" });
      hookedCollection.on("before.update", async ({
        getDocument
      }) => {
        const doc = await getDocument();
        assert.ok(doc._id, "doc has an ID");
      });
      hookedCollection.on("after.update.success", async ({
        getDocument
      }) => {
        const doc = await getDocument();
        assert.strictEqual(doc.thing, 1, "thing is set");
      });
      await hookedCollection.updateOne({}, { $set: { thing: 1 } });
    });

    it("if there are no before/after update hooks, there should be no extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      await hookedCollection.updateOne({}, { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 1, "Only one DB operation");
    });

    it("if there are before/after update hooks, there should be a single extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.update", () => {});
      hookedCollection.on("before.update", () => {});
      hookedCollection.on("after.update", () => {});
      hookedCollection.on("after.update", () => {});
      await hookedCollection.updateOne({}, { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 2, "Only two DB operation");
    });

    it("if before hooks access the document, there should be a single extraneous DB operation per document", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.update", async ({ getDocument }) => {
        await getDocument();
      });
      hookedCollection.on("before.update", async ({ getDocument }) => {
        await getDocument();
      });
      await hookedCollection.updateOne({}, { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 3, "Only three DB operation");
    });

    it("if any before hook running specifies greedyFetch, there should NOT be a single extraneous DB operation per document", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.update", async ({ getDocument }) => {
        await getDocument();
      }, { greedyFetch: true });
      hookedCollection.on("before.update", async ({ getDocument }) => {
        await getDocument();
      });
      await hookedCollection.updateOne({}, { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 2, "Only two DB operation");
    });
  });
}
