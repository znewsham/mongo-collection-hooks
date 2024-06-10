import { describe, it } from "node:test";
import assert from "node:assert";

import { combineProjections, unionOfProjections, isProjectionExclusion } from "../lib/utils.js";


describe("utils", () => {
  describe("isProjectionExclusion", () => {
    it("should work for 1", () => {
      assert.equal(isProjectionExclusion({ a: 1 }), false);
    });
    it("should work for 0", () => {
      assert.equal(isProjectionExclusion({ a: 0 }), true);
    });
    it("should work for { a: 0 }", () => {
      assert.equal(isProjectionExclusion({ a: { a: 0 } }), false);
    });
    it("should work for { a: 1 }", () => {
      assert.equal(isProjectionExclusion({ a: { a: 1 } }), false);
    });
  });
  describe("combineProjections", () => {
    const cases = [
      // simple (in)equality cases.
      { args: [1, 1, false, false], result: { hasNestedKeys: false, isExclusion: false, projection: 1 } },
      { args: [0, 0, true, true], result: { hasNestedKeys: false, isExclusion: true, projection: 0 } },
      { args: [0, 1, true, false], result: { hasNestedKeys: false, isExclusion: false, projection: {} } },
      { args: [1, 0, false, true], result: { hasNestedKeys: false, isExclusion: false, projection: {} } },
      // inclusion on one side, undefined on the other - results in. skip the key.
      { args: [1, undefined, false, false], result: { hasNestedKeys: false, isExclusion: false, projection: 1 } },
      { args: [1, undefined, false, true], result: { hasNestedKeys: false, isExclusion: false, projection: null } },
      { args: [undefined, 1, false, false], result: { hasNestedKeys: false, isExclusion: false, projection: 1 } },
      { args: [undefined, 1, true, false], result: { hasNestedKeys: false, isExclusion: false, projection: null } },
      // exclusion on one side, undefined on the other - results in. skip the key.
      { args: [0, undefined, true, false], result: { hasNestedKeys: false, isExclusion: true, projection: 0 } },
      { args: [0, undefined, true, true], result: { hasNestedKeys: false, isExclusion: false, projection: {} } },
      { args: [undefined, 0, false, true], result: { hasNestedKeys: false, isExclusion: true, projection: 0 } },
      { args: [undefined, 0, true, true], result: { hasNestedKeys: false, isExclusion: false, projection: {} } },

      // inclusion + nested inclusion
      { args: [1, { a: 1 }, false, false], result: { hasNestedKeys: false, isExclusion: false, projection: 1 } },
      { args: [{ a: 1 }, 1, false, false], result: { hasNestedKeys: false, isExclusion: false, projection: 1 } },
      { args: [{ a: 1 }, { a: 1 }, false, false], result: { hasNestedKeys: true, isExclusion: false, projection: { a: 1 } } },
      { args: [{ a: 1 }, { b: 1 }, false, false], result: { hasNestedKeys: true, isExclusion: false, projection: { a: 1, b: 1 } } },
      { args: [{ a: 1 }, { }, false, false], result: { hasNestedKeys: true, isExclusion: false, projection: { a: 1 } } },

      // exclusion + nested exclusion
      { args: [0, { a: 0 }, false, false], result: { hasNestedKeys: true, isExclusion: false, projection: { a: 0 } } },
      { args: [{ a: 0 }, 0, false, false], result: { hasNestedKeys: true, isExclusion: false, projection: { a: 0 } } },
      { args: [{ a: 0 }, { a: 0 }, false, false], result: { hasNestedKeys: true, isExclusion: false, projection: { a: 0 } } },
      { args: [{ a: 0 }, { b: 0 }, false, false], result: { hasNestedKeys: false, isExclusion: false, projection: 1 } },
      { args: [{ b: 0 }, { a: 0 }, false, false], result: { hasNestedKeys: false, isExclusion: false, projection: 1 } },
      { args: [{ a: 0 }, { a: 1 }, false, false], result: { hasNestedKeys: false, isExclusion: false, projection: 1 } },
      { args: [{ a: 1 }, { a: 0 }, false, false], result: { hasNestedKeys: false, isExclusion: false, projection: 1 } },
    ];
    cases.forEach(({ args, result }) => {
      it(`should work for ${args.map(arg => arg === undefined ? arg : JSON.stringify(arg))}`, () => {
        assert.deepEqual(
          combineProjections(...args),
          result
        );
      });
    });
  });
  describe("unionOfProjections", () => {
    it("Should work with simple inclusions", () => {
      assert.deepEqual(
        unionOfProjections([
          { a: 1 },
          { b: 1 }
        ]),
        { a: 1, b: 1 }
      );
    });
    it("Should work with nested inclusions first, and total inclusion second", () => {
      assert.deepEqual(
        unionOfProjections([
          {
            a: {
              c: 1
            }
          },
          { a: 1 }
        ]),
        { a: 1 }
      );
    });
    it("Should work with nested inclusions", () => {
      assert.deepEqual(
        unionOfProjections([
          {
            a: {
              b: 1
            }
          },
          {
            a: {
              c: 1
            }
          }
        ]),
        { a: { b: 1, c: 1 } }
      );
    });
    it("Should work with nested exclusions", () => {
      assert.deepEqual(
        unionOfProjections([
          {
            a: {
              b: 0
            }
          },
          {
            a: {
              c: 0
            }
          }
        ]),
        { a: 1 }
      );
    });
    it("Should work with nested mixed exclusions and inclusions", () => {
      assert.deepEqual(
        unionOfProjections([
          {
            a: {
              b: 1
            }
          },
          {
            a: {
              c: 0
            }
          }
        ]),
        { a: { c: 0 } }
      );
    });
    it("Should work with nested matching exclusions", () => {
      assert.deepEqual(
        unionOfProjections([
          {
            a: {
              b: 0
            }
          },
          {
            a: {
              b: 0
            },
            c: 1
          }
        ]),
        { a: { b: 0 }, c: 1 }
      );
    });
    it("Should work with _id excluded in one", () => {
      assert.deepEqual(
        unionOfProjections([
          {
            a: 1
          },
          {
            a: 1,
            _id: 0
          }
        ]),
        { a: 1 }
      );
    });
    it("Should work with _id excluded in all", () => {
      assert.deepEqual(
        unionOfProjections([
          {
            a: 1,
            _id: 0
          },
          {
            a: 1,
            _id: 0
          }
        ]),
        { a: 1, _id: 0 }
      );
    });
    it("Should work with internal _id", () => {
      assert.deepEqual(
        unionOfProjections([
          {
            a: {
              _id: 0
            }
          },
          {
            a: {
              b: 1
            }
          }
        ]),
        { a: { _id: 0 } }
      );
    });
  });
});
