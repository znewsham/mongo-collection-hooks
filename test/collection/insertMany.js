import { SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { assertImplements } from "../helpers.js";


export function defineInsertMany() {
  describe.only("insertMany", () => {
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

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.insertMany.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "insertMany", () => { throw new Error("BAD CALL"); });
          return hookedCollection.insertMany([]);
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });

    it("should call the hooks with the correct arguments", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }]);
      const beforeInsert = mock.fn();
      const beforeInsertMany = mock.fn();
      const afterInsert = mock.fn();
      const afterInsertMany = mock.fn();
      hookedCollection.on("before.insert", beforeInsert);
      hookedCollection.on("after.insert.success", afterInsert);
      hookedCollection.on("before.insertMany", beforeInsertMany);
      hookedCollection.on("after.insertMany.success", afterInsertMany);
      const args = [[{ _id: "test2" }, { _id: "test3" }], undefined];
      await hookedCollection.insertMany(...args);
      assertImplements(beforeInsert.mock.calls, [
        {
          arguments: [{
            args,
            argsOrig: args,
            caller: "insertMany",
            doc: args[0][0],
            docOrig: args[0][0],
            thisArg: hookedCollection
          }]
        },
        {
          arguments: [{
            args,
            argsOrig: args,
            caller: "insertMany",
            doc: args[0][1],
            docOrig: args[0][1],
            thisArg: hookedCollection
          }]
        }
      ], "called the beforeUpdate hook correctly");
      assertImplements(beforeInsertMany.mock.calls[0].arguments, [{
        args,
        argsOrig: args,
        thisArg: hookedCollection
      }], "called the before{N} hook correctly");
      assertImplements(afterInsertMany.mock.calls[0].arguments, [{
        args,
        argsOrig: args,
        result: {
          acknowledged: true, insertedCount: 2, insertedIds: { 0: "test2", 1: "test3" }
        },
        resultOrig: {
          acknowledged: true, insertedCount: 2, insertedIds: { 0: "test2", 1: "test3" }
        },
        thisArg: hookedCollection
      }], "called the after{N} hook correctly");

      assertImplements(afterInsert.mock.calls, [
        {
          arguments: [{
            args,
            argsOrig: args,
            caller: "insertMany",
            doc: args[0][0],
            result: {
              acknowledged: true, insertedId: "test2"
            },
            resultOrig: {
              acknowledged: true, insertedId: "test2"
            },
            thisArg: hookedCollection
          }]
        },
        {
          arguments: [{
            args,
            argsOrig: args,
            caller: "insertMany",
            doc: args[0][1],
            result: {
              acknowledged: true, insertedId: "test3"
            },
            resultOrig: {
              acknowledged: true, insertedId: "test3"
            },
            thisArg: hookedCollection
          }]
        }
      ], "called the afterUpdate hook correctly");
    });
    it("Should skip documents correctly", async () => {
      const { hookedCollection } = getHookedCollection();
      let first = true;
      hookedCollection.on("before.insert", () => {
        if (first) {
          first = false;
          return SkipDocument;
        }
      });
      const afterInsertMock = mock.fn();
      hookedCollection.on("after.insert.success", afterInsertMock);
      const result = await hookedCollection.insertMany([{ _id: "test" }, { _id: "test2" }]);
      assert.deepEqual(result, { acknowledged: true, insertedIds: { 0: "test2" }, insertedCount: 1 });
      assert.strictEqual(afterInsertMock.mock.callCount(), 1, "Should have only called after.insert for one doc");
    });

    it("Should skip documents correctly when multiple hooks are chained, even if a later hook returns a non-SkipDocument value", async () => {
      const { hookedCollection } = getHookedCollection();
      const seenByHook = { A: [], B: [], C: [], D: [] };
      hookedCollection.on("before.insert", ({ doc, isSkipped }) => {
        seenByHook.A.push({doc, isSkipped});
        return { ...doc, a: 1 };
      });
      hookedCollection.on("before.insert", ({ doc, isSkipped }) => {
        seenByHook.B.push({doc, isSkipped});
        if (doc._id === "skipMe") {
          return SkipDocument;
        }
      });
      hookedCollection.on("before.insert", ({ doc, isSkipped }) => {
        seenByHook.C.push({doc, isSkipped});
        return { ...doc, c: 1 };
      });
      hookedCollection.on("before.insert", ({ doc, isSkipped }) => {
        seenByHook.D.push({doc, isSkipped});
      });
      const afterInsertMock = mock.fn();
      hookedCollection.on("after.insert.success", afterInsertMock);
      const result = await hookedCollection.insertMany([{ _id: "skipMe" }, { _id: "keepMe" }]);

      assert.strictEqual(seenByHook.A.length, 2, "Hook A runs for every doc");
      assert.strictEqual(seenByHook.B.length, 2, "Hook B runs for every doc");
      assert.strictEqual(seenByHook.C.length, 2, "Hook C runs for every doc, including the one Hook B asked to skip");
      assert.strictEqual(seenByHook.D.length, 2, "Hook D runs for every doc, including the one Hook B asked to skip");

      const skipMeAtC = seenByHook.C.find(d => d.doc._id === "skipMe");
      const skipMeAtD = seenByHook.D.find(d => d.doc._id === "skipMe");
      assert.deepEqual(skipMeAtC, { doc: { _id: "skipMe", a: 1 }, isSkipped: true }, "Hook C must not receive SkipDocument for the skipped doc; it receives the previous chained value");
      assert.deepEqual(skipMeAtD, { doc: { _id: "skipMe", a: 1, c: 1 }, isSkipped: true }, "Hook D receives the value returned by Hook C even though Hook B returned SkipDocument");

      assert.deepEqual(result, { acknowledged: true, insertedIds: { 0: "keepMe" }, insertedCount: 1 }, "Only the non-skipped doc is inserted");
      assert.strictEqual(afterInsertMock.mock.callCount(), 1, "after.insert.success runs only for the non-skipped doc");
      assert.deepEqual(afterInsertMock.mock.calls[0].arguments[0].doc, { _id: "keepMe", a: 1, c: 1 }, "The non-skipped doc still flows through every transforming hook");
    });

    it.only("after.* hooks should fire (success and error) when no before.* hooks are present", async () => {
      const { hookedCollection: hcOk } = getHookedCollection();
      const okAfterInsert = mock.fn();
      const okAfterInsertMany = mock.fn();
      hcOk.on("after.insert.success", okAfterInsert);
      hcOk.on("after.insertMany.success", okAfterInsertMany);
      hcOk.on("after.insert.error", () => assert.fail("after.insert.error must not fire on success"));
      hcOk.on("after.insertMany.error", () => assert.fail("after.insertMany.error must not fire on success"));
      await hcOk.insertMany([{ _id: "ok1" }, { _id: "ok2" }]);
      assert.strictEqual(okAfterInsert.mock.callCount(), 2, "after.insert.success fires once per doc without before hooks");
      assert.strictEqual(okAfterInsertMany.mock.callCount(), 1, "after.insertMany.success fires without before hooks");

      const { hookedCollection: hcErr, fakeCollection: fcErr } = getHookedCollection();
      mock.method(fcErr, "insertMany", () => { throw new Error("BAD INSERT MANY"); });
      const errAfterInsert = mock.fn();
      const errAfterInsertMany = mock.fn();
      hcErr.on("after.insert.error", errAfterInsert);
      hcErr.on("after.insertMany.error", errAfterInsertMany);
      hcErr.on("after.insert.success", () => assert.fail("after.insert.success must not fire on error"));
      hcErr.on("after.insertMany.success", () => assert.fail("after.insertMany.success must not fire on error"));
      await assert.rejects(() => hcErr.insertMany([{ _id: "fail1" }, { _id: "fail2" }]), /BAD INSERT MANY/);
      assert.strictEqual(errAfterInsert.mock.callCount(), 2, "after.insert.error fires once per doc without before hooks");
      assert.strictEqual(errAfterInsertMany.mock.callCount(), 1, "after.insertMany.error fires without before hooks");
    });

    it("after.insert hooks fire correctly (success and error) when before.insert returns a totally new object", async () => {
      const { hookedCollection: hcOk, fakeCollection: fcOk } = getHookedCollection();
      const mockInsertManyOk = mock.method(fcOk, "insertMany");
      hcOk.on("before.insert", ({ doc }) => ({ _id: `${doc._id}-new`, transformed: true }));
      const okAfterInsert = mock.fn();
      hcOk.on("after.insert.success", okAfterInsert);
      hcOk.on("after.insert.error", () => assert.fail("after.insert.error must not fire on success"));

      const result = await hcOk.insertMany([{ _id: "first" }, { _id: "second" }]);
      assert.deepEqual(result, { acknowledged: true, insertedIds: { 0: "first-new", 1: "second-new" }, insertedCount: 2 }, "the inserted ids reflect the new docs");
      assert.deepEqual(mockInsertManyOk.mock.calls[0].arguments[0], [{ _id: "first-new", transformed: true }, { _id: "second-new", transformed: true }], "the underlying insertMany receives the totally-new docs");
      assert.strictEqual(okAfterInsert.mock.callCount(), 2);
      assert.deepEqual(okAfterInsert.mock.calls[0].arguments[0].doc, { _id: "first-new", transformed: true });
      assert.deepEqual(okAfterInsert.mock.calls[0].arguments[0].docOrig, { _id: "first" });
      assert.deepEqual(okAfterInsert.mock.calls[1].arguments[0].doc, { _id: "second-new", transformed: true });
      assert.deepEqual(okAfterInsert.mock.calls[1].arguments[0].docOrig, { _id: "second" });

      const { hookedCollection: hcErr, fakeCollection: fcErr } = getHookedCollection();
      mock.method(fcErr, "insertMany", () => { throw new Error("BAD INSERT MANY"); });
      hcErr.on("before.insert", ({ doc }) => ({ _id: `${doc._id}-new`, transformed: true }));
      const errAfterInsert = mock.fn();
      hcErr.on("after.insert.error", errAfterInsert);
      hcErr.on("after.insert.success", () => assert.fail("after.insert.success must not fire on error"));
      await assert.rejects(() => hcErr.insertMany([{ _id: "first" }, { _id: "second" }]), /BAD INSERT MANY/);
      assert.strictEqual(errAfterInsert.mock.callCount(), 2);
      assert.deepEqual(errAfterInsert.mock.calls[0].arguments[0].doc, { _id: "first-new", transformed: true }, "after.insert.error receives the new doc");
      assert.deepEqual(errAfterInsert.mock.calls[0].arguments[0].docOrig, { _id: "first" });
      assert.match(errAfterInsert.mock.calls[0].arguments[0].error.message, /BAD INSERT MANY/);
    });

    it("should use chained options instead of original options", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection();
      const mockInsertMany = mock.method(fakeCollection, "insertMany");

      hookedCollection.on("before.insertMany", ({ args }) => {
        const [docs, options] = args;
        return [docs, { ...options, comment: "modified options" }];
      });

      const docs = [{ _id: "test1" }, { _id: "test2" }];
      const originalOptions = { comment: "original options" };
      await hookedCollection.insertMany(docs, originalOptions);

      assert.strictEqual(mockInsertMany.mock.calls.length, 1);
      const passedOptions = mockInsertMany.mock.calls[0].arguments[1];
      assert.deepEqual(passedOptions, { comment: "modified options" });
    });
  });
}
