// @ts-check
import { describe } from "node:test";
import { defineCountTests } from "./count.js";
import { defineToArrayTests } from "./toArray.js";
import { defineForEachTests } from "./forEach.js";
import { defineNextTests } from "./next.js";
import { defineAsyncIteratorTests } from "./asyncIterator.js";

describe("findCursor", () => {
  defineToArrayTests();
  defineCountTests();
  defineForEachTests();
  defineNextTests();
  defineAsyncIteratorTests();
});
