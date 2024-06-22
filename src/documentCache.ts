import type { Collection, InferIdType, WithId, Document } from "mongodb";
import { NestedProjectionOfTSchema } from "./events/helpersTypes.js";

export class DocumentCache<TSchema extends Document> {
  #map: Map<InferIdType<TSchema>, Promise<WithId<TSchema> | null>> = new Map();
  #collection: Collection<TSchema>;
  #projection: NestedProjectionOfTSchema<TSchema>;
  #dontLoadDocuments: boolean;
  #signal?: AbortSignal;

  constructor(
    collection: Collection<TSchema>,
    projection: NestedProjectionOfTSchema<TSchema>,
    dontLoadDocuments: boolean,
    signal: AbortSignal | undefined
  ) {
    this.#collection = collection;
    this.#projection = projection;
    this.#dontLoadDocuments = dontLoadDocuments;
    this.#signal = signal;
  }

  getDocument(id: InferIdType<TSchema>): Promise<WithId<TSchema> | null> {
    if (!this.#map.has(id)) {
      if (this.#dontLoadDocuments) {
        return Promise.resolve(null);
      }

      // INTENTIONALLY *NOT* await
      // @ts-expect-error
      this.#map.set(id, raceSignal(this.#signal, this.#collection.findOne({ _id: id }, { projection: this.#projection})));
    }
    return this.#map.get(id) || Promise.resolve(null);
  }

  setDocument(id: InferIdType<TSchema>, doc: WithId<TSchema>): void {
    this.#map.set(id, Promise.resolve(doc));
  }
}
