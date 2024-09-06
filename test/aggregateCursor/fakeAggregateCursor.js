import { FakeFindCursor } from "../findCursor/fakeFindCursor.js";

export class FakeAggregationCursor extends FakeFindCursor {
  #pipeline;
  #options;
  constructor(pipeline, options) {
    super({});
    this.#pipeline = pipeline;
    this.#options = options;
  }
}
