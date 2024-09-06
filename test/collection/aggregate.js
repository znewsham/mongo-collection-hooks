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
  });
}
