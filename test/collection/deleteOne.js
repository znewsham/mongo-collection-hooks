import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";


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

    it("should call the error hook", async () => {
      assert.rejects(
        () => hookInParallel("after.deleteOne.error", "result", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "deleteOne", () => { throw new Error(); });
          return hookedCollection.deleteOne({});
        })
      );
    });

    it("should allow access to the doc inside the hook", async () => {
      const { hookedCollection } = getHookedCollection([]);
      await hookedCollection.insertOne({ _id: "test" });
      await hookedCollection.insertOne({ _id: "test1" });
      hookedCollection.on("before.delete", async ({
        getDocument
      }) => {
        const doc = await getDocument();
        assert.ok(doc._id, "doc has an ID");
      });
      await hookedCollection.deleteOne({});
    });

    it("if there are no before/after delete hooks, there should be no extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      await hookedCollection.deleteOne({});
      assert.strictEqual(fakeCollection.callCount, 1, "Only one DB operation");
    });

    it("if there are before/after delete hooks, there should be a single extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.delete", () => {});
      hookedCollection.on("before.delete", () => {});
      hookedCollection.on("after.delete", () => {});
      hookedCollection.on("after.delete", () => {});
      await hookedCollection.deleteOne({});
      assert.strictEqual(fakeCollection.callCount, 2, "Only two DB operation");
    });

    it("if before hooks access the document, there should be a single extraneous DB operation per document", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.delete", async ({ getDocument }) => {
        await getDocument();
      });
      hookedCollection.on("before.delete", async ({ getDocument }) => {
        await getDocument();
      });
      await hookedCollection.deleteOne({});
      assert.strictEqual(fakeCollection.callCount, 3, "Only three DB operation");
    });

    it("if any before hook running specifies greedyFetch, there should NOT be a single extraneous DB operation per document", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.delete", async ({ getDocument }) => {
        await getDocument();
      }, { greedyFetch: true });
      hookedCollection.on("before.delete", async ({ getDocument }) => {
        await getDocument();
      });
      await hookedCollection.deleteOne({});
      assert.strictEqual(fakeCollection.callCount, 2, "Only two DB operation");
    });

    it("Should skip documents correctly", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      hookedCollection.on("before.delete", () => SkipDocument);
      const afterDeleteMock = mock.fn();
      hookedCollection.on("after.delete.success", afterDeleteMock);
      const result = await hookedCollection.deleteOne({ _id: "test" });
      assert.strictEqual(afterDeleteMock.mock.callCount(), 0, "Should not call after.insert.success");
      assert.deepEqual(result, { deletedCount: 0, acknowledged: false });
    });
  });
}
