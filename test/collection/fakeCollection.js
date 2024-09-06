import { compileMongoQuery } from "mongo-query-compiler";
import { LocalCollection } from "@blastjs/minimongo/dist/local_collection.js";
import { FakeFindCursor } from "../findCursor/fakeFindCursor.js";
import { FakeAggregationCursor } from "../aggregateCursor/fakeAggregateCursor.js";


function safeCompile(filter) {
  if (!filter || Object.keys(filter).length === 0) {
    return () => true;
  }
  return compileMongoQuery(filter);
}

/**
 *
 * @typedef {import("mongodb").Collection} Collection
 * @implements {Collection}
 */
export class FakeCollection {
  #data;
  #transform;
  constructor(data = [], transform = a => a) {
    this.#data = data;
    this.#transform = transform;
  }

  aggregate(pipeline, options) {
    return new FakeAggregationCursor(pipeline, options);
  }

  find(filter, options) {
    return new FakeFindCursor(this.#data.filter(safeCompile(filter)), filter, options);
  }

  findOne(filter) {
    return this.#data.find(safeCompile(filter));
  }

  distinct(key, filter) {
    const docs = this.#data.filter(safeCompile(filter));
    return Array.from(new Set(docs.map(doc => doc[key])));
  }

  insertOne(doc) {
    this.#data.push(doc);
    return {
      acknowledged: true,
      insertedId: doc._id
    };
  }

  insertMany(docs) {
    docs.forEach(doc => this.#data.push(doc));
    return {
      acknowledged: true,
      insertedCount: docs.length,
      insertedIds: Object.fromEntries(docs.map(({ _id }, index) => [index, _id]))
    };
  }

  deleteOne(filter) {
    const doc = this.#data.find(safeCompile(filter));
    if (doc) {
      this.#data.splice(this.#data.indexOf(doc), 1);
    }
    return {
      acknowledged: true,
      deletedCount: doc ? 1 : 0
    };
  }

  deleteMany(filter) {
    const docs = this.#data.filter(safeCompile(filter));
    docs.forEach(doc => this.#data.splice(this.#data.indexOf(doc), 1));

    return {
      acknowledged: true,
      deletedCount: docs.length
    };
  }

  replaceOne(filter, replacement, { upsert }) {
    const doc = this.#data.find(safeCompile(filter));
    if (!doc && upsert) {
      this.#data.push(replacement);
      return {
        upsertedCount: 1,
        upsertedId: replacement._id
      };
    }
    else {
      const index = this.docs.indexOf(doc);
      this.docs[index] = { ...replacement, _id: doc._id };
      return {

      };
    }
  }

  updateOne(filter, $modifier) {
    const doc = this.#data.find(safeCompile(filter));
    const before = JSON.stringify(doc);
    if (doc) {
      LocalCollection._modify(doc, $modifier);
    }
    const after = JSON.stringify(doc);
    return {
      acknowledged: true,
      matchedCount: doc ? 1 : 0,
      modifiedCount: before !== after ? 1 : 0,
      upsertedCount: 0
    };
  }

  updateMany(filter, $modifier) {
    const docs = this.#data.filter(safeCompile(filter));
    let count = 0;
    docs.forEach((doc) => {
      const before = JSON.stringify(doc);
      if (doc) {
        LocalCollection._modify(doc, $modifier);
      }
      const after = JSON.stringify(doc);
      if (before !== after) {
        count++;
      }
    });
    return {
      acknowledged: true,
      matchedCount: docs.length,
      modifiedCount: count,
      upsertedCount: 0
    };
  }

  countDocuments(filter) {
    return this.find(filter).count();
  }
}


/**
 * @typedef {import("../src/events.js").EventNames} EventNames
 * @typedef {import("mongodb").Collection} Collection
 */
