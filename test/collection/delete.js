import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";

export function deleteTests(oneOrMany) {
  describe("delete", () => {
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
      await hookedCollection[oneOrMany]({});
    });

    it("if there are no before/after delete hooks, there should be no extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      await hookedCollection[oneOrMany]({});
      assert.strictEqual(fakeCollection.callCount, 1, "Only one DB operation");
    });

    it("if there are before/after delete hooks, there should be a single extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.delete", () => {});
      hookedCollection.on("before.delete", () => {});
      hookedCollection.on("after.delete", () => {});
      hookedCollection.on("after.delete", () => {});
      await hookedCollection[oneOrMany]({});
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
      await hookedCollection[oneOrMany]({});
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
      await hookedCollection[oneOrMany]({});
      assert.strictEqual(fakeCollection.callCount, 2, "Only two DB operation");
    });

    it("Should skip documents correctly", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      hookedCollection.on("before.delete", () => SkipDocument);
      const afterDeleteMock = mock.fn();
      hookedCollection.on("after.delete.success", afterDeleteMock);

      const result = await hookedCollection[oneOrMany]({ _id: "test" });
      assert.strictEqual(afterDeleteMock.mock.callCount(), 0, "Should not call after.delete.success");
      assert.deepEqual(result, { deletedCount: 0, acknowledged: false });
    });

    it("Should skip documents correctly when multiple hooks are chained, even if a later hook returns a non-SkipDocument value", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      const seenFilters = [];
      hookedCollection.on("before.delete", ({ filter }) => {
        seenFilters.push({ hook: "A", filter });
        return { ...filter, a: 1 };
      });
      hookedCollection.on("before.delete", ({ filter }) => {
        seenFilters.push({ hook: "B", filter });
        return SkipDocument;
      });
      hookedCollection.on("before.delete", ({ filter, isSkipped }) => {
        seenFilters.push({ hook: "C", filter, isSkipped });
        return { ...filter, c: 1 };
      });
      hookedCollection.on("before.delete", ({ filter, isSkipped }) => {
        seenFilters.push({ hook: "D", filter, isSkipped });
      });
      const afterDeleteMock = mock.fn();
      hookedCollection.on("after.delete.success", afterDeleteMock);

      const result = await hookedCollection[oneOrMany]({ _id: "test" });

      assert.strictEqual(seenFilters.length, 4, "All four before.delete hooks should run");
      assert.deepEqual(seenFilters[0].filter, { _id: "test" }, "Hook A receives the original filter");
      assert.deepEqual(seenFilters[1].filter, { _id: "test", a: 1 }, "Hook B receives the filter returned by Hook A");
      assert.deepEqual(seenFilters[2].filter, { _id: "test", a: 1 }, "Hook C must not receive SkipDocument; it receives the previous chained filter");
      assert.deepEqual(seenFilters[3].filter, { _id: "test", a: 1, c: 1 }, "Hook D receives the filter returned by Hook C even though Hook B returned SkipDocument");
      assert.deepEqual(seenFilters[2].isSkipped, true, "Hook C isSkipped");
      assert.deepEqual(seenFilters[3].isSkipped, true, "Hook D isSkipped");

      assert.strictEqual(afterDeleteMock.mock.callCount(), 0, "after.delete.success must not run when the document was skipped");
      assert.deepEqual(result, { deletedCount: 0, acknowledged: false }, "The skip is respected even though a later hook returned a non-SkipDocument value");
    });

    it("Should correctly provide the previous document in the after hook", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const afterDeleteMock = mock.fn();
      hookedCollection.on("after.delete", afterDeleteMock, { fetchPrevious: true });
      const result = await hookedCollection[oneOrMany]({ _id: "test" });
      assert.strictEqual(afterDeleteMock.mock.callCount(), 1, "Should call after.delete");
      assert.deepEqual(afterDeleteMock.mock.calls[0].arguments[0].previousDocument, { _id: "test" }, "Should call after.delete");
      if (oneOrMany === "findOneAndDelete") {
        assert.deepEqual(result, { value: { _id: "test" }, ok: 1 });
      }
      else {
        assert.deepEqual(result, { deletedCount: 1, acknowledged: true });
      }
    });

    it("after.* hooks should fire (success and error) when no before.* hooks are present", async () => {
      const perDocMethod = oneOrMany === "findOneAndDelete" ? "findOneAndDelete" : "deleteOne";

      const { hookedCollection: hcOk } = getHookedCollection([{ _id: "test" }]);
      const okAfterDelete = mock.fn();
      hcOk.on("after.delete.success", okAfterDelete);
      hcOk.on("after.delete.error", () => assert.fail("after.delete.error must not fire on success"));
      await hcOk[oneOrMany]({ _id: "test" });
      assert.strictEqual(okAfterDelete.mock.callCount(), 1, "after.delete.success fires without before hooks");

      const { hookedCollection: hcErr, fakeCollection: fcErr } = getHookedCollection([{ _id: "test" }]);
      mock.method(fcErr, perDocMethod, () => { throw new Error("BAD DELETE"); });
      const errAfterDelete = mock.fn();
      hcErr.on("after.delete.error", errAfterDelete);
      hcErr.on("after.delete.success", () => assert.fail("after.delete.success must not fire on error"));
      await assert.rejects(() => hcErr[oneOrMany]({ _id: "test" }));
      assert.strictEqual(errAfterDelete.mock.callCount(), 1, "after.delete.error fires without before hooks");
      assert.match(errAfterDelete.mock.calls[0].arguments[0].error.message, /BAD DELETE/);
    });
  });
}
