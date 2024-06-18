import { compileMongoQuery } from "mongo-query-compiler";
import { LocalCollection } from "@blastjs/minimongo/dist/local_collection.js";
import { FakeFindCursor } from "../findCursor/fakeFindCursor.js";
import { FakeAggregationCursor } from "../aggregationCursor/fakeAggregationCursor.js";


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
  #callCount = 0;
  constructor(data = [], transform = a => a) {
    this.#data = data;
    this.#transform = transform;
  }

  get callCount() {
    return this.#callCount;
  }

  aggregate(pipeline, options) {
    this.#callCount++;
    return new FakeAggregationCursor(pipeline, options);
  }

  find(filter, options) {
    this.#callCount++;
    return new FakeFindCursor(this.#data.filter(safeCompile(filter)), filter, options);
  }

  findOne(filter) {
    this.#callCount++;
    const item = this.#data.find(safeCompile(filter));
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  distinct(key, filter) {
    this.#callCount++;
    const docs = this.#data.filter(safeCompile(filter));
    return Array.from(new Set(docs.map(doc => doc[key])));
  }

  insertOne(doc) {
    this.#callCount++;
    this.#data.push(doc);
    return {
      acknowledged: true,
      insertedId: doc._id
    };
  }

  insertMany(docs) {
    this.#callCount++;
    docs.forEach(doc => this.#data.push(doc));
    return {
      acknowledged: true,
      insertedCount: docs.length,
      insertedIds: Object.fromEntries(docs.map(({ _id }, index) => [index, _id]))
    };
  }

  deleteOne(filter) {
    this.#callCount++;
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
    this.#callCount++;
    const docs = this.#data.filter(safeCompile(filter));
    docs.forEach(doc => this.#data.splice(this.#data.indexOf(doc), 1));

    return {
      acknowledged: true,
      deletedCount: docs.length
    };
  }

  replaceOne(filter, replacement, { upsert } = {}) {
    this.#callCount++;
    const doc = this.#data.find(safeCompile(filter));
    if (!doc && upsert) {
      this.#data.push(replacement);
      return {
        upsertedCount: 1,
        upsertedId: replacement._id
      };
    }
    else if (!doc) {
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0
      };
    }
    const index = this.#data.indexOf(doc);
    this.#data[index] = { ...replacement, _id: doc._id };
    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1
    };
  }

  updateOne(filter, $modifier) {
    this.#callCount++;
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
    this.#callCount++;
    const docs = this.#data.filter(safeCompile(filter));
    let count = 0;
    docs.forEach((doc) => {
      const before = JSON.stringify(doc);
      if (doc) {
        LocalCollection._modify(JSON.parse(JSON.stringify(doc)), $modifier);
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
    // this.#callCount++; - handled by find
    return this.find(filter).count();
  }

  count(filter) {
    // this.#callCount++; - handled by find
    return this.find(filter).count();
  }

  async estimatedDocumentCount() {
    this.#callCount++;
    return this.#data.length;
  }

  async findOneAndUpdate(filter, mutator, options) {
    this.#callCount++;
    const doc = await this.findOne(filter);
    this.#callCount--;
    if (doc) {
      await this.updateOne({ _id: doc._id }, mutator);
      this.#callCount--;
    }
    if (options?.includeResultMetadata === false) {
      return doc;
    }
    return {
      value: doc,
      ok: 1
    };
  }

  async findOneAndReplace(filter, replacement, options) {
    this.#callCount++;
    const doc = await this.findOne(filter);
    this.#callCount--;
    if (doc) {
      await this.replaceOne({ _id: doc._id }, replacement);
      this.#callCount--;
    }
    if (options?.includeResultMetadata === false) {
      return doc;
    }
    return {
      value: doc,
      ok: 1
    };
  }

  async findOneAndDelete(filter, options) {
    this.#callCount++;
    const doc = await this.findOne(filter);
    this.#callCount--;
    if (doc) {
      await this.deleteOne({ _id: doc._id });
      this.#callCount--;
    }
    if (options?.includeResultMetadata === false) {
      return doc;
    }
    return {
      value: doc,
      ok: 1
    };
  }
}


/**
 * @typedef {import("../src/events.js").EventNames} EventNames
 * @typedef {import("mongodb").Collection} Collection
 */
