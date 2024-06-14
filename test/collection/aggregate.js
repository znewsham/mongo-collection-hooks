import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCollection } from "./helpers.js";
import { HookedAggregationCursor } from "../../lib/hookedAggregationCursor.js";


export function defineAggregate() {
  describe("aggregate", () => {
    it("should pass the options between before hooks correctly", async () => {
      const { hookedCollection } = getHookedCollection();
      const beforeHook1 = mock.fn(({
        args,
        argsOrig
      }) => {
        assert.deepEqual(args, argsOrig);
        return [{}];
      });
      const beforeHook2 = mock.fn(({
        args,
        argsOrig
      }) => {
        assert.notDeepEqual(args, argsOrig);
        return [{}];
      });
      hookedCollection.on("before.aggregate", beforeHook1);
      hookedCollection.on("before.aggregate", beforeHook2);
      const cursor = hookedCollection.aggregate([]);
      assert.ok(cursor instanceof HookedAggregationCursor, "Got a cursor");
      assert.strictEqual(beforeHook1.mock.callCount(), 1);
      assert.strictEqual(beforeHook2.mock.callCount(), 1);
    });

    it("should pass the result between after hooks correctly", async () => {
      const { hookedCollection } = getHookedCollection();
      const afterHook1 = mock.fn(({
        result,
        resultOrig
      }) => {
        assert.deepEqual(result, resultOrig);
        return false;
      });
      const afterHook2 = mock.fn(({
        result,
        resultOrig
      }) => {
        assert.notDeepEqual(result, resultOrig);
        return false;
      });
      hookedCollection.on("after.aggregate.success", afterHook1);
      hookedCollection.on("after.aggregate.success", afterHook2);
      const cursor = hookedCollection.aggregate([]);
      assert.ok(cursor === false, "Didn't get a cursor");
      assert.strictEqual(afterHook1.mock.callCount(), 1);
      assert.strictEqual(afterHook2.mock.callCount(), 1);
    });
    it("should call the correct hooks on success", () => {
      const beforeHook = mock.fn();
      const afterHook = mock.fn();
      const errorHook = mock.fn();
      const { hookedCollection } = getHookedCollection([]);
      hookedCollection.on("before.aggregate", beforeHook);
      hookedCollection.on("after.aggregate.success", afterHook);
      hookedCollection.on("after.aggregate.error", errorHook);
      hookedCollection.aggregate();
      assert.strictEqual(beforeHook.mock.callCount(), 1);
      assert.strictEqual(afterHook.mock.callCount(), 1);
      assert.strictEqual(errorHook.mock.callCount(), 0);
    });
    it("should call the correct hooks on error", () => {
      const beforeHook = mock.fn();
      const afterHook = mock.fn();
      const errorHook = mock.fn();
      const { hookedCollection, fakeCollection } = getHookedCollection([]);
      hookedCollection.on("before.aggregate", beforeHook);
      hookedCollection.on("after.aggregate.success", afterHook);
      hookedCollection.on("after.aggregate.error", errorHook);
      mock.method(fakeCollection, "aggregate", () => {
        throw new Error();
      });
      assert.throws(() => hookedCollection.aggregate());
      assert.strictEqual(beforeHook.mock.callCount(), 1);
      assert.strictEqual(afterHook.mock.callCount(), 0);
      assert.strictEqual(errorHook.mock.callCount(), 1);
    });

    it("should pass on the relevant hooks to the cursor", () => {
      const { hookedCollection } = getHookedCollection([]);
      hookedCollection.on("after.aggregation.cursor.toArray.success", () => {});
      hookedCollection.on("after.find.cursor.toArray.success", () => {});
      const cursor = hookedCollection.aggregate();
      assert.strictEqual(cursor.ee.awaitableListeners("after.find.cursor.toArray.success").length, 0);
      assert.strictEqual(cursor.ee.awaitableListeners("after.aggregation.cursor.toArray.success").length, 1);
    });
  });
}
