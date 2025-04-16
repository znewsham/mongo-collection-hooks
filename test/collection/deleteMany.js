import { BulkWriteError, SkipDocument } from "mongo-collection-hooks";
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection, hookInParallel, hooksChain } from "./helpers.js";
import { deleteTests } from "./delete.js";
import { assertImplements } from "../helpers.js";
import { MongoBulkWriteError } from "mongodb";
import { setTimeout } from "node:timers/promises";


export function defineDeleteMany() {
  describe("deleteMany", () => {
    it("should pass the options between before hooks correctly", async () => {
      const result = await hooksChain("before.deleteMany", "args", ({ hookedCollection }) => hookedCollection.deleteMany({ _id: "test" }), [[{ _id: "test" }], [{ _id: "test" }]]);
      assert.deepEqual(result, { acknowledged: true, deletedCount: 1 }, "It deleted");
    });

    it("should pass the result between after hooks correctly", async () => {
      const result = await hooksChain("after.deleteMany.success", "result", ({ hookedCollection }) => hookedCollection.deleteMany({ _id: "test" }));
      assert.deepEqual(result, "Hello World");
    });

    it("should provide the correct args to the hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const mockBefore = mock.fn();
      const mockAfter = mock.fn();
      hookedCollection.on("before.deleteMany", mockBefore);
      hookedCollection.on("after.deleteMany.success", mockAfter);
      await hookedCollection.deleteMany({});
      assertImplements(
        mockBefore.mock.calls[0].arguments,
        [{
          args: [{}, undefined],
          argsOrig: [{}, undefined],
          thisArg: hookedCollection
        }],
        "before hook is correct"
      );

      assertImplements(
        mockAfter.mock.calls[0].arguments,
        [{
          args: [{}, undefined],
          argsOrig: [{}, undefined],
          result: { acknowledged: true, deletedCount: 2 },
          resultOrig: { acknowledged: true, deletedCount: 2 },
          thisArg: hookedCollection
        }],
        "after hook is correct"
      );
    });

    it("should provide the correct args (with id) to the hooks", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const mockBefore = mock.fn();
      const mockAfter = mock.fn();
      hookedCollection.on("before.deleteMany", mockBefore, { includeIds: true });
      hookedCollection.on("after.deleteMany.success", mockAfter, { includeIds: true });
      await hookedCollection.deleteMany({});
      assertImplements(
        mockBefore.mock.calls[0].arguments,
        [{
          args: [{}, undefined],
          argsOrig: [{}, undefined],
          _ids: ["test", "test2"],
          thisArg: hookedCollection
        }],
        "before hook is correct"
      );

      assertImplements(
        mockAfter.mock.calls[0].arguments,
        [{
          args: [{}, undefined],
          argsOrig: [{}, undefined],
          _ids: ["test", "test2"],
          result: { acknowledged: true, deletedCount: 2 },
          resultOrig: { acknowledged: true, deletedCount: 2 },
          thisArg: hookedCollection
        }],
        "after hook is correct"
      );
    });

    it("should call the error hook", async () => {
      await assert.rejects(
        () => hookInParallel("after.deleteMany.error", async ({ hookedCollection, fakeCollection }) => {
          mock.method(fakeCollection, "deleteMany", () => { throw new Error("BAD CALL"); });
          return hookedCollection.deleteMany({});
        }),
        /BAD CALL/,
        "It rejected correctly"
      );
    });

    it("should use chained options instead of original options", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const mockDeleteMany = mock.method(fakeCollection, "deleteMany");
      
      hookedCollection.on("before.deleteMany", ({ args }) => {
        const [filter, options] = args;
        return [filter, { ...options, comment: "modified options" }];
      });

      const filter = { _id: { $in: ["test", "test2"] } };
      const originalOptions = { comment: "original options" };
      await hookedCollection.deleteMany(filter, originalOptions);
      
      assert.strictEqual(mockDeleteMany.mock.calls.length, 1);
      const passedOptions = mockDeleteMany.mock.calls[0].arguments[1];
      assert.deepEqual(passedOptions, { comment: "modified options" });
    });

    it("if one delete hook throws an error, we should throw a MongoBulkWriteError", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      let first = true;
      hookedCollection.on("before.delete", () => {
        if (first) {
          first = false;
          return;
        }
        throw new Error("Bad Error");
      });

      await assert.rejects(
        async () => {
          console.log(await hookedCollection.deleteMany({}));
        },
        (thrown) => {
          if (!(thrown instanceof BulkWriteError)) {
            return false;
          }
          return thrown.deletedCount === 1;
        },
        "It rejected correctly"
      );
    });

    it("if first delete throws an error, we should throw a MongoBulkWriteError", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      let first = true;
      hookedCollection.on("before.delete", () => {

      });

      const deleteMock = mock.method(fakeCollection, "deleteOne", () => {
        if (first) {
          first = false;
          throw new Error("bad error");
        }
        return {
          ok: 1,
          deletedCount: 1
        };
      });

      await assert.rejects(
        async () => {
          await hookedCollection.deleteMany({});
        },
        (thrown) => {
          if (!(thrown instanceof BulkWriteError)) {
            return false;
          }
          return thrown.deletedCount === 0;
        },
        "It rejected correctly"
      );

      assert.strictEqual(deleteMock.mock.callCount(), 1, "Should have called delete once");
    });

    it("if second delete throws an error, we should throw a MongoBulkWriteError", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      let first = true;
      hookedCollection.on("before.delete", () => {

      });

      const deleteMock = mock.method(fakeCollection, "deleteOne", () => {
        if (first) {
          first = false;
          return {
            ok: 1,
            deletedCount: 1
          };
        }
        throw new Error("bad error");
      });

      await assert.rejects(
        async () => {
          await hookedCollection.deleteMany({});
        },
        (thrown) => {
          if (!(thrown instanceof BulkWriteError)) {
            return false;
          }
          return thrown.deletedCount === 1;
        },
        "It rejected correctly"
      );

      assert.strictEqual(deleteMock.mock.callCount(), 2, "Should have called delete twice");
    });

    it("when ordered=false if one delete throws an error, we should throw a MongoBulkWriteError but continue.", async () => {
      const { hookedCollection, fakeCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      let first = true;
      hookedCollection.on("before.delete", () => {

      });

      const deleteMock = mock.method(fakeCollection, "deleteOne", () => {
        if (first) {
          first = false;
          throw new Error("bad error");
        }
        return {
          ok: 1,
          deletedCount: 1
        };
      });

      await assert.rejects(
        async () => {
          await hookedCollection.deleteMany({}, { ordered: false });
        },
        (thrown) => {
          if (!(thrown instanceof BulkWriteError)) {
            return false;
          }
          return thrown.deletedCount === 1;
        },
        "It rejected correctly"
      );

      assert.strictEqual(deleteMock.mock.callCount(), 2, "Should have called delete twice");
    });

    it("when ordered=undefined deletes should run serially", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const beforeHookTimes = [];
      const mockBefore = mock.fn(async () => {
        beforeHookTimes.push(performance.now());
        await setTimeout(100);
      });
      hookedCollection.on("before.delete", mockBefore);
      await hookedCollection.deleteMany({});
      assert.strictEqual(mockBefore.mock.callCount(), 2, "Should have been called twice");
      assert.ok(beforeHookTimes[1] - beforeHookTimes[0] > 50, "Should have a substantial difference in hook time");
    });

    it("when ordered=true deletes should run serially", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const beforeHookTimes = [];
      const mockBefore = mock.fn(async () => {
        beforeHookTimes.push(performance.now());
        await setTimeout(100);
      });
      hookedCollection.on("before.delete", mockBefore);
      await hookedCollection.deleteMany({}, { ordered: true });
      assert.strictEqual(mockBefore.mock.callCount(), 2, "Should have been called twice");
      assert.ok(beforeHookTimes[1] - beforeHookTimes[0] > 50, "Should have a substantial difference in hook time");
    });

    it("when ordered=false deletes should run in parallel", async () => {
      const { hookedCollection } = getHookedCollection([{ _id: "test" }, { _id: "test2" }]);
      const beforeHookTimes = [];
      const mockBefore = mock.fn(async () => {
        beforeHookTimes.push(performance.now());
        await setTimeout(100);
      });
      hookedCollection.on("before.delete", mockBefore);
      await hookedCollection.deleteMany({}, { ordered: false });
      assert.strictEqual(mockBefore.mock.callCount(), 2, "Should have been called twice");
      assert.ok(beforeHookTimes[1] - beforeHookTimes[0] < 50, "Should NOT have a substantial difference in hook time");
    });

    it("when ordered=false deletes should in a batch run in parallel, between batches run in parallel", async () => {
      const { hookedCollection } = getHookedCollection([
        { _id: "test" },
        { _id: "test2" },
        { _id: "test3" },
        { _id: "test4" }
      ]);
      const beforeHookTimes = [];
      const mockBefore = mock.fn(async () => {
        beforeHookTimes.push(performance.now());
        await setTimeout(100);
      });
      hookedCollection.on("before.delete", mockBefore);
      await hookedCollection.deleteMany({}, { ordered: false, hookBatchSize: 2 });
      assert.strictEqual(mockBefore.mock.callCount(), 4, "Should have been called twice");
      assert.ok(beforeHookTimes[1] - beforeHookTimes[0] < 50, "Should NOT have a substantial difference in hook time");
      assert.ok(beforeHookTimes[2] - beforeHookTimes[1] > 50, "Should have a substantial difference in hook time");
      assert.ok(beforeHookTimes[3] - beforeHookTimes[2] < 50, "Should NOT have a substantial difference in hook time");
    });

    deleteTests("deleteMany");
  });
}
