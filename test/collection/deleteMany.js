import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";


export function defineDeleteMany() {
  describe("deleteMany", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.deleteMany", "args", ({ hookedCollection }) => hookedCollection.deleteMany({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, { acknowledged: true, deletedCount: 0 }, "It deleted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.deleteMany.success", "result", ({ hookedCollection }) => hookedCollection.deleteMany({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should call the error hook", async () => {
      assert.rejects(
        () => hookInParallel("after.deleteMany.error", "result", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "deleteMany", () => { throw new Error(); });
          return hookedCollection.deleteMany({});
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
      await hookedCollection.deleteMany({});
    });

    it("if there are no before/after delete hooks, there should be no extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      await hookedCollection.deleteMany({});
      assert.strictEqual(fakeCollection.callCount, 1, "Only one DB operation");
    });

    it("if there are before/after delete hooks, there should be a single extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.delete", () => {});
      hookedCollection.on("before.delete", () => {});
      hookedCollection.on("after.delete", () => {});
      hookedCollection.on("after.delete", () => {});
      await hookedCollection.deleteMany({});
      assert.strictEqual(fakeCollection.callCount, 2, "Only two DB operation");
    });

    it("Should skip documents correctly", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      let first = true;
      hookedCollection.on("before.delete", () => {
        if (first) {
          first = false;
          return SkipDocument;
        }
      });
      const afterDeleteMock = mock.fn();
      hookedCollection.on("after.delete.success", afterDeleteMock);
      const result = await hookedCollection.deleteMany({});
      assert.deepEqual(result, { acknowledged: true, deletedCount: 1 });
      assert.strictEqual(afterDeleteMock.mock.callCount(), 1, "Should have only called after.insert for one doc");
    });
  });
}
