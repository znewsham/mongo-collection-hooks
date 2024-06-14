import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { getHookedCursor } from "./helpers.js";


export function defineRewindTests() {
  describe("rewind", () => {
    it("should call the correct hooks on success", () => {
      const beforeHook = mock.fn();
      const afterHook = mock.fn();
      const errorHook = mock.fn();
      const { hookedCursor } = getHookedCursor(
        [],
        {
          "before.aggregation.cursor.rewind": [{ listener: beforeHook }],
          "after.aggregation.cursor.rewind.success": [{ listener: afterHook }],
          "after.aggregation.cursor.rewind.error": [{ listener: errorHook }]
        }
      );
      hookedCursor.rewind();
      assert.strictEqual(beforeHook.mock.callCount(), 1);
      assert.strictEqual(afterHook.mock.callCount(), 1);
      assert.strictEqual(errorHook.mock.callCount(), 0);
    });
    it("should call the correct hooks on error", () => {
      const beforeHook = mock.fn();
      const afterHook = mock.fn();
      const errorHook = mock.fn();
      const { hookedCursor, fakeCursor } = getHookedCursor(
        [],
        {
          "before.aggregation.cursor.rewind": [{ listener: beforeHook }],
          "after.aggregation.cursor.rewind.success": [{ listener: afterHook }],
          "after.aggregation.cursor.rewind.error": [{ listener: errorHook }]
        }
      );
      mock.method(fakeCursor, "rewind", () => {
        throw new Error();
      });
      assert.throws(() => hookedCursor.rewind());
      assert.strictEqual(beforeHook.mock.callCount(), 1);
      assert.strictEqual(afterHook.mock.callCount(), 0);
      assert.strictEqual(errorHook.mock.callCount(), 1);
    });
    it("should call the correct (generic) hooks on success", () => {
      const beforeHook = mock.fn();
      const afterHook = mock.fn();
      const errorHook = mock.fn();
      const { hookedCursor } = getHookedCursor(
        [],
        {
          "before.cursor.rewind": [{ listener: beforeHook }],
          "after.cursor.rewind.success": [{ listener: afterHook }],
          "after.cursor.rewind.error": [{ listener: errorHook }]
        }
      );
      hookedCursor.rewind();
      assert.strictEqual(beforeHook.mock.callCount(), 1);
      assert.strictEqual(afterHook.mock.callCount(), 1);
      assert.strictEqual(errorHook.mock.callCount(), 0);
    });
    it("should call the correct (generic) hooks on error", () => {
      const beforeHook = mock.fn();
      const afterHook = mock.fn();
      const errorHook = mock.fn();
      const { hookedCursor, fakeCursor } = getHookedCursor(
        [],
        {
          "before.cursor.rewind": [{ listener: beforeHook }],
          "after.cursor.rewind.success": [{ listener: afterHook }],
          "after.cursor.rewind.error": [{ listener: errorHook }]
        }
      );
      mock.method(fakeCursor, "rewind", () => {
        throw new Error();
      });
      assert.throws(() => hookedCursor.rewind());
      assert.strictEqual(beforeHook.mock.callCount(), 1);
      assert.strictEqual(afterHook.mock.callCount(), 0);
      assert.strictEqual(errorHook.mock.callCount(), 1);
    });
  });
}
