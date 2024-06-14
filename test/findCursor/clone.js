import { describe, it } from "node:test";
import assert from "node:assert";
import { getHookedCursor } from "./helpers.js";

export function defineCloneTests() {
  describe("clone", () => {
    it("Should have the same hooks", () => {
      const { hookedCursor } = getHookedCursor([], {
        "before.cursor.toArray": [{ listener: () => {} }]
      });
      const cloned = hookedCursor.clone();
      assert.strictEqual(cloned.ee.awaitableListeners("before.cursor.toArray").length, 1);
    });
  });
}
