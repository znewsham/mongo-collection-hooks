// Ignore the implementation details of this class - the important piece is that it implements the relevant portion of the API (in this case simply insertOne)

import type { Collection, DropCollectionOptions, InsertOneOptions, InsertOneResult, OptionalUnlessRequiredId } from "mongodb";

type StringIdDocument = {
  _id: string
};

class AsyncTransaction<T extends any = void> {
  #transaction: IDBTransaction;
  #promise: Promise<T>;
  #resolve: (result: any) => void;
  #reject: (error: any) => void;
  #result?: T;

  constructor(db: IDBDatabase, collectionNames: string[], mode: IDBTransactionMode) {
    this.#transaction = db.transaction(collectionNames, mode);
    this.#promise = new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
    this.#transaction.onerror = err => this.#reject(err);
    this.#transaction.oncomplete = () => this.#resolve(this.#result);
  }

  get transaction() {
    return this.#transaction;
  }

  async commit(result: T): Promise<T> {
    this.#result = result;
    this.#transaction.commit();
    return this.#promise;
  }

  abort(error: any) {
    this.#reject(error);
  }
}

export class LocalStorageCollection<TSchema extends StringIdDocument> implements Pick<Collection<TSchema>, "insertOne" | "drop"> {
  #dbName: string;
  #collectionName: string;
  #db?: Promise<IDBDatabase>;

  async #getDb(): Promise<IDBDatabase> {
    if (!this.#db) {
      this.#db = new Promise<IDBDatabase>((resolve, reject) => {
        const collectionName = this.#collectionName;
        const request = window.indexedDB.open(this.#dbName, 2);
        request.onsuccess = function() {
          resolve(request.result);
        }
        request.onerror = function(event) {
          reject(event);
        }
      })
      .then((db) => {
        if (!db.objectStoreNames.contains(this.#collectionName)) {
          return new Promise<IDBDatabase>((resolve, reject) => {
            const request = db.createObjectStore(this.#collectionName);
            resolve(db);
          });
        }
        return db;
      });
    }
    return this.#db;
  }

  constructor(dbName: string, collectionName: string) {
    this.#dbName = dbName;
    this.#collectionName = collectionName;
  }

  async insertOne(
    doc: OptionalUnlessRequiredId<TSchema>,
    options?: InsertOneOptions | undefined
  ): Promise<InsertOneResult<TSchema>> {
    const transaction = new AsyncTransaction<InsertOneResult<StringIdDocument>>(await this.#getDb(), [this.#collectionName], "readwrite");
    const objectStore = transaction.transaction.objectStore(this.#collectionName);
    try {
      objectStore.add(doc, doc._id);
      return transaction.commit({
        acknowledged: true,
        insertedId: doc._id
      });
    }
    catch (e) {
      transaction.abort(e);
      throw e;
    }
  }

  async drop(options?: DropCollectionOptions | undefined): Promise<boolean> {
    const transaction = new AsyncTransaction<boolean>(await this.#getDb(), [this.#collectionName], "readwrite");

    const objectStore = transaction.transaction.objectStore(this.#collectionName);
    objectStore.clear();
    return transaction.commit(true);
  }
}
