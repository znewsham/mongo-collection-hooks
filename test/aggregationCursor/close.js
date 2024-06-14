// @ts-check
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { declareSimpleTests, hookInParallel, hooksChain } from "./helpers.js";

export function defineCloseTests() {
  describe("close", () => {
    declareSimpleTests("close", [() => {}], undefined, [1, 2, 3]);
  });

  it("should call the before hooks in parallel", async () => {
    await hookInParallel("before.aggregation.cursor.close", ({ hookedCursor }) => hookedCursor.close());
  });

  it("should call the error hooks in parallel", async () => {
    await hookInParallel("after.aggregation.cursor.close.error", async ({ hookedCursor, fakeCursor }) => {
      mock.method(fakeCursor, "close", () => { throw new Error("test"); });
      try {
        await hookedCursor.close();
      }
      catch (e) {}
    });
  });


  it("should call the (generic) before hooks in parallel", async () => {
    await hookInParallel("before.cursor.close", ({ hookedCursor }) => hookedCursor.close());
  });

  it("should call the (generic) error hooks in parallel", async () => {
    await hookInParallel("after.cursor.close.error", async ({ hookedCursor, fakeCursor }) => {
      mock.method(fakeCursor, "close", () => { throw new Error("test"); });
      try {
        await hookedCursor.close();
      }
      catch (e) {}
    });
  });
  it("should pass the result between (generic) after hooks correctly", async () => {
    await hookInParallel("after.cursor.close.success", ({ hookedCursor }) => hookedCursor.close());
  });
}
