import { HookedFindCursor } from "../../lib/hookedFindCursor.js";

export class FakeFindCursor {
  #i = 0;
  #id;
  #data;
  #transform;
  #filter;
  #options;
  constructor(data = [], filter, options, transform = a => a) {
    this.#data = data;
    this.#filter = filter;
    this.#options = options || {};
    this.#transform = transform;
  }

  get id() {
    return this.#id;
  }

  #applyProjection(obj) {
    // simple only
    let copy = {};
    if (!this.#options.projection || Object.entries(this.#options.projection).length === 0) {
      copy = obj;
    }
    Object.entries(this.#options.projection || {}).filter(([, value]) => value === 1).forEach(([key]) => {copy[key] = obj[key];});
    return copy;
  }


  async toArray() {
    return this.#data.slice(this.#i, this.#options?.limit)
    .map(a => this.#applyProjection(JSON.parse(JSON.stringify(a))))
    .map(a => this.#transform(a));
  }

  async count() {
    return this.#data.length;
  }

  async forEach(iterator) {
    return (await this.toArray()).forEach(iterator);
  }

  async rewind() {
    this.#i = 0;
  }

  _initialize(cb) {
    this.#id = "fake";
    cb(undefined, {});
  }

  async next() {
    if (this.#i === this.#options.limit) {
      return null;
    }
    const next = this.#data[this.#i++];
    return next ? this.#transform(this.#applyProjection(JSON.parse(JSON.stringify(next)))) : null;
  }

  async* [Symbol.asyncIterator]() {
    for (const item of this.#data.slice(this.#i, this.#options.limit)) {
      yield this.#transform(this.#applyProjection(JSON.parse(JSON.stringify(item))));
    }
  }

  clone() {
    return this;
  }

  project() {
    return this;
  }
  map(transform) {
    this.#transform = transform;
    return this;
  }

  async close() {

  }
}

/**
 * @typedef {import("../../src/events.js").EventNames} EventNames
 * @typedef {import("mongodb").FindCursor} FindCursor
 */

/**
 *
 * @param {any[]} data
 * @param {Record<K, HookedListenerCallback<K, any, any>[]>} events
 * @template {EventNames} K
 */
export function getHookedCursor(
  data = [],
  events = {}
) {
  /** @type FindCursor */
  const fakeCursor = new FakeFindCursor(data, {});
  const hookedCursor = new HookedFindCursor({}, fakeCursor, { invocationSymbol: Symbol("findCall"), events, interceptExecute: true });
  return { hookedCursor, fakeCursor };
}
