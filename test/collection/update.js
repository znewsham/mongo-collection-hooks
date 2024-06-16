import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";


export function updateTests(oneOrMany) {
  describe("update", () => {
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
      await hookedCollection[oneOrMany]({}, { $set: { thing: 1 } });
    });

    it("if there are no before/after update hooks, there should be no extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      await hookedCollection[oneOrMany]({}, { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 1, "Only one DB operation");
    });

    it("if there are before/after update hooks, there should be a single extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.update", () => {});
      hookedCollection.on("before.update", () => {});
      hookedCollection.on("after.update", () => {});
      hookedCollection.on("after.update", () => {});
      await hookedCollection[oneOrMany]({}, { $set: { a: 1 } });
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
      await hookedCollection[oneOrMany]({}, { $set: { a: 1 } });
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
      await hookedCollection[oneOrMany]({}, { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 2, "Only two DB operation");
    });
    it("Should skip documents correctly", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.update", () => SkipDocument);
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock);
      const result = await hookedCollection[oneOrMany]({ _id: "test" }, { $set: { a: 1 } });
      assert.strictEqual(afterUpdateMock.mock.callCount(), 0, "Should have only called after.update for one doc");
      assert.deepEqual(result, {
        acknowledged: false, matchedCount: 1, modifiedCount: 0, upsertedCount: 0, upsertedId: null
      });
    });
    it("Should greedily fetch the document if an after hook has fetchPrevious", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock, { fetchPrevious: true });
      const result = await hookedCollection[oneOrMany]({ _id: "test" }, { $set: { a: 1 } });
      assert.strictEqual(afterUpdateMock.mock.callCount(), 1, "Should have only called after.update for one doc");
      assert.deepEqual(afterUpdateMock.mock.calls[0].arguments[0].previousDocument, { _id: "test" }, "Should have access to the previous document");
      assert.deepEqual(result, {
        acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
      });
    });
    it("Should not have access to the previous document if nothing called fetchPrevious", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock, { fetchPrevious: false });
      const result = await hookedCollection[oneOrMany]({ _id: "test" }, { $set: { a: 1 } });
      assert.strictEqual(afterUpdateMock.mock.callCount(), 1, "Should have only called after.update for one doc");
      assert.deepEqual(afterUpdateMock.mock.calls[0].arguments[0].previousDocument, undefined, "Should NOT have access to the previous document");
      assert.deepEqual(result, {
        acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
      });
    });
    it("Should adhere to the previous projection", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test", omitted: "omitted" }]);
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock, { fetchPrevious: true, fetchPreviousProjection: { _id: 1 } });
      const result = await hookedCollection[oneOrMany]({ _id: "test" }, { $set: { a: 1 } });
      assert.strictEqual(afterUpdateMock.mock.callCount(), 1, "Should have only called after.update for one doc");
      assert.deepEqual(afterUpdateMock.mock.calls[0].arguments[0].previousDocument, { _id: "test" }, "Should have access to the previous document");
      assert.deepEqual(result, {
        acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
      });
    });
    it("Should have access to the previous doc if ANY hook does", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test", omitted: "omitted" }]);
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock);
      hookedCollection.on("after.update.success", () => {}, { fetchPrevious: true, fetchPreviousProjection: { _id: 1 } });
      const result = await hookedCollection[oneOrMany]({ _id: "test" }, { $set: { a: 1 } });
      assert.strictEqual(afterUpdateMock.mock.callCount(), 1, "Should have only called after.update for one doc");
      assert.deepEqual(afterUpdateMock.mock.calls[0].arguments[0].previousDocument, { _id: "test" }, "Should have access to the previous document");
      assert.deepEqual(result, {
        acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
      });
    });
  });
}
