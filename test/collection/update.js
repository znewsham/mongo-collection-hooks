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
      await hookedCollection[oneOrMany]({}, oneOrMany.includes("eplace") ? { thing: 1 } : { $set: { thing: 1 } });
    });

    it("if there are no before/after update hooks, there should be no extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      await hookedCollection[oneOrMany]({}, oneOrMany.includes("eplace") ? { a: 1 } : { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 1, "Only one DB operation");
    });

    it("if there are before/after update hooks, there should be a single extraneous DB operations", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.update", () => {});
      hookedCollection.on("before.update", () => {});
      hookedCollection.on("after.update", () => {});
      hookedCollection.on("after.update", () => {});
      await hookedCollection[oneOrMany]({}, oneOrMany.includes("eplace") ? { a: 1 } : { $set: { a: 1 } });
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
      await hookedCollection[oneOrMany]({}, oneOrMany.includes("eplace") ? { a: 1 } : { $set: { a: 1 } });
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
      await hookedCollection[oneOrMany]({}, oneOrMany.includes("eplace") ? { a: 1 } : { $set: { a: 1 } });
      assert.strictEqual(fakeCollection.callCount, 2, "Only two DB operation");
    });
    it("Should skip documents correctly", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      hookedCollection.on("before.update", () => SkipDocument);
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock);
      const result = await hookedCollection[oneOrMany]({ _id: "test" }, oneOrMany.includes("eplace") ? { a: 1 } : { $set: { a: 1 } });
      assert.strictEqual(afterUpdateMock.mock.callCount(), 0, "Should have only called after.update for one doc");
      if (oneOrMany.startsWith("findOneAnd")) {
        assert.deepEqual(result, { ok: 0, value: null });
      }
      else {
        assert.deepEqual(result, {
          acknowledged: false, matchedCount: 1, modifiedCount: 0, upsertedCount: 0, upsertedId: null
        });
      }
    });

    it("Should skip documents correctly when multiple hooks are chained, even if a later hook returns a non-SkipDocument value", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      const isReplace = oneOrMany.includes("eplace");
      const callArgs = isReplace ? [{ _id: "test" }, { a: 1 }] : [{ _id: "test" }, { $set: { a: 1 } }];
      const seenFilterMutators = [];
      hookedCollection.on("before.update", ({ filterMutator }) => {
        seenFilterMutators.push({ hook: "A", filterMutator });
        return { ...filterMutator, filter: { ...filterMutator.filter, a: 1 } };
      });
      hookedCollection.on("before.update", ({ filterMutator }) => {
        seenFilterMutators.push({ hook: "B", filterMutator });
        return SkipDocument;
      });
      hookedCollection.on("before.update", ({ filterMutator, isSkipped }) => {
        seenFilterMutators.push({ hook: "C", filterMutator, isSkipped });
        return { ...filterMutator, filter: { ...filterMutator.filter, c: 1 } };
      });
      hookedCollection.on("before.update", ({ filterMutator, isSkipped }) => {
        seenFilterMutators.push({ hook: "D", filterMutator, isSkipped });
      });
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock);

      const result = await hookedCollection[oneOrMany](...callArgs);

      assert.strictEqual(seenFilterMutators.length, 4, "All four before.update hooks should run");
      assert.deepEqual(seenFilterMutators[0].filterMutator.filter, { _id: "test" }, "Hook A receives the original filter");
      assert.deepEqual(seenFilterMutators[1].filterMutator.filter, { _id: "test", a: 1 }, "Hook B receives the filter from Hook A");
      assert.deepEqual(seenFilterMutators[2].filterMutator.filter, { _id: "test", a: 1 }, "Hook C must not receive SkipDocument; it receives the previous chained filterMutator");
      assert.deepEqual(seenFilterMutators[3].filterMutator.filter, { _id: "test", a: 1, c: 1 }, "Hook D receives the filterMutator returned by Hook C even though Hook B returned SkipDocument");
      assert.deepEqual(seenFilterMutators[2].isSkipped, true, "Hook C isSkipped");
      assert.deepEqual(seenFilterMutators[3].isSkipped, true, "Hook D isSkipped");

      assert.strictEqual(afterUpdateMock.mock.callCount(), 0, "after.update.success must not run when the document was skipped");
      if (oneOrMany.startsWith("findOneAnd")) {
        assert.deepEqual(result, { ok: 0, value: null }, "The skip is respected even though a later hook returned a non-SkipDocument value");
      }
      else {
        assert.deepEqual(result, {
          acknowledged: false, matchedCount: 1, modifiedCount: 0, upsertedCount: 0, upsertedId: null
        }, "The skip is respected even though a later hook returned a non-SkipDocument value");
      }
    });
    it("Should greedily fetch the document if an after hook has fetchPrevious", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock, { fetchPrevious: true });

      const result = await hookedCollection[oneOrMany]({ _id: "test" }, oneOrMany.includes("eplace") ? { a: 1 } : { $set: { a: 1 } });
      assert.strictEqual(afterUpdateMock.mock.callCount(), 1, "Should have only called after.update for one doc");
      assert.deepEqual(afterUpdateMock.mock.calls[0].arguments[0].previousDocument, { _id: "test" }, "Should have access to the previous document");
      if (oneOrMany.startsWith("findOneAnd")) {
        assert.deepEqual(result, { ok: 1, value: { _id: "test" } });
      }
      else {
        assert.deepEqual(result, {
          acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
        });
      }
    });
    it("Should not have access to the previous document if nothing called fetchPrevious", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }]);
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock, { fetchPrevious: false });
      const result = await hookedCollection[oneOrMany]({ _id: "test" }, oneOrMany.includes("eplace") ? { a: 1 } : { $set: { a: 1 } });
      assert.strictEqual(afterUpdateMock.mock.callCount(), 1, "Should have only called after.update for one doc");
      assert.deepEqual(afterUpdateMock.mock.calls[0].arguments[0].previousDocument, undefined, "Should NOT have access to the previous document");

      if (oneOrMany.startsWith("findOneAnd")) {
        assert.deepEqual(result, { ok: 1, value: { _id: "test" } });
      }
      else {
        assert.deepEqual(result, {
          acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
        });
      }
    });
    it("Should adhere to the previous projection", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test", omitted: "omitted" }]);
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock, { fetchPrevious: true, fetchPreviousProjection: { _id: 1 } });
      const result = await hookedCollection[oneOrMany]({ _id: "test" }, oneOrMany.includes("eplace") ? { a: 1 } : { $set: { a: 1 } });
      assert.strictEqual(afterUpdateMock.mock.callCount(), 1, "Should have only called after.update for one doc");
      assert.deepEqual(afterUpdateMock.mock.calls[0].arguments[0].previousDocument, { _id: "test" }, "Should have access to the previous document");

      if (oneOrMany.startsWith("findOneAnd")) {
        assert.deepEqual(result, { ok: 1, value: { _id: "test", omitted: "omitted" } });
      }
      else {
        assert.deepEqual(result, {
          acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
        });
      }
    });
    it("Should have access to the previous doc if ANY hook does", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test", omitted: "omitted" }]);
      const afterUpdateMock = mock.fn();
      hookedCollection.on("after.update.success", afterUpdateMock);
      hookedCollection.on("after.update.success", () => {}, { fetchPrevious: true, fetchPreviousProjection: { _id: 1 } });
      const result = await hookedCollection[oneOrMany]({ _id: "test" }, oneOrMany.includes("eplace") ? { a: 1 } : { $set: { a: 1 } });
      assert.strictEqual(afterUpdateMock.mock.callCount(), 1, "Should have only called after.update for one doc");
      assert.deepEqual(afterUpdateMock.mock.calls[0].arguments[0].previousDocument, { _id: "test" }, "Should have access to the previous document");
      if (oneOrMany.startsWith("findOneAnd")) {
        assert.deepEqual(result, { ok: 1, value: { _id: "test", omitted: "omitted" } });
      }
      else {
        assert.deepEqual(result, {
          acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null
        });
      }
    });

    it("after.* hooks should fire (success and error) when no before.* hooks are present", async () => {
      const isReplace = oneOrMany.includes("eplace");
      const isFindOneAnd = oneOrMany.startsWith("findOneAnd");
      const perDocMethod = isFindOneAnd ? oneOrMany : (isReplace ? "replaceOne" : "updateOne");
      const callArgs = isReplace ? [{ _id: "test" }, { a: 1 }] : [{ _id: "test" }, { $set: { a: 1 } }];

      const { hookedCollection: hcOk } = getHookedCollection([{ _id: "test" }]);
      const okAfterUpdate = mock.fn();
      hcOk.on("after.update.success", okAfterUpdate);
      hcOk.on("after.update.error", () => assert.fail("after.update.error must not fire on success"));
      await hcOk[oneOrMany](...callArgs);
      assert.strictEqual(okAfterUpdate.mock.callCount(), 1, "after.update.success fires without before hooks");

      const { hookedCollection: hcErr, fakeCollection: fcErr } = getHookedCollection([{ _id: "test" }]);
      mock.method(fcErr, perDocMethod, () => { throw new Error("BAD UPDATE"); });
      const errAfterUpdate = mock.fn();
      hcErr.on("after.update.error", errAfterUpdate);
      hcErr.on("after.update.success", () => assert.fail("after.update.success must not fire on error"));
      await assert.rejects(() => hcErr[oneOrMany](...callArgs));
      assert.strictEqual(errAfterUpdate.mock.callCount(), 1, "after.update.error fires without before hooks");
      assert.match(errAfterUpdate.mock.calls[0].arguments[0].error.message, /BAD UPDATE/);
    });
  });
}
