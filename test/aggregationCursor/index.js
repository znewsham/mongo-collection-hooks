// @ts-check
import { describe } from "node:test";
import { defineToArrayTests } from "./toArray.js";
import { defineForEachTests } from "./forEach.js";
import { defineNextTests } from "./next.js";
import { defineAsyncIteratorTests } from "./asyncIterator.js";

describe("aggregationCursor", () => {
  defineToArrayTests();
  defineForEachTests();
  defineNextTests();
  defineAsyncIteratorTests();
});
