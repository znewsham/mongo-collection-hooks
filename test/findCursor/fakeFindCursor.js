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
    this.#options = options;
    this.#transform = transform;
  }

  get id() {
    return this.#id;
  }

  async toArray() {
    return this.#data.slice(this.#i).map(a => this.#transform(a));
  }

  async count() {
    return this.#data.length;
  }

  async forEach(iterator) {
    return this.#data.slice(this.#i).forEach(iterator);
  }

  async rewind() {
    this.#i = 0;
  }

  _initialize(cb) {
    this.#id = "fake";
    cb(undefined, {});
  }

  async next() {
    return this.#data[this.#i++] || null;
  }

  async* [Symbol.asyncIterator]() {
    for (const item of this.#data.slice(this.#i)) {
      yield item;
    }
  }

  project() {
    return this;
  }
  map(transform) {
    this.#transform = transform;
    return this;
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
