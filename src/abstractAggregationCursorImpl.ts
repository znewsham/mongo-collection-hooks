import type {
  Document,
  ExplainVerbosityLike,
  Sort,
  AggregationCursor,
} from "mongodb";
import { AbstractHookedCursor } from "./abstractCursorImpl.js";

export abstract class AbstractHookedAggregationCursor<TSchema extends any = any> extends AbstractHookedCursor<TSchema> implements AggregationCursor<TSchema> {
  #cursor: AggregationCursor<TSchema>;
  constructor(cursor: AggregationCursor<TSchema>) {
    super(cursor);
    this.#cursor = cursor;
  }

  get pipeline(): Document[] {
    return this.#cursor.pipeline;
  }

  group<T = TSchema>($group: Document): AggregationCursor<T> {
    this.#cursor.group($group);
    return this as unknown as AggregationCursor<T>;
  }

  limit($limit: number): this {
    this.#cursor.limit($limit);
    return this;
  }

  match($match: Document): this {
    this.#cursor.match($match);
    return this;
  }

  out($out: string | { db: string; coll: string; }): this {
    this.#cursor.out($out);
    return this;
  }

  lookup($lookup: Document): this {
    this.#cursor.lookup($lookup);
    return this;
  }

  project<T extends Document = Document>($project: Document): AggregationCursor<T> {
    this.#cursor.project($project);
    return this as unknown as AggregationCursor<T>;
  }

  explain(verbosity?: ExplainVerbosityLike | undefined): Promise<Document> {
    return this.#cursor.explain(verbosity);
  }

  redact($redact: Document): this {
    this.#cursor.redact($redact);
    return this;
  }

  skip($skip: number): this {
    this.#cursor.skip($skip);
    return this;
  }
  sort($sort: Sort): this {
    this.#cursor.sort($sort);
    return this;
  }
  geoNear($geoNear: Document): this {
    this.#cursor.geoNear($geoNear);
    return this;
  }
  unwind($unwind: string | Document): this {
    this.#cursor.unwind($unwind);
    return this;
  }

  abstract clone(): AggregationCursor<TSchema>;
  map<T = any>(transform: (doc: TSchema) => T): AggregationCursor<T> {
    this.#cursor.map(transform);
    return this as unknown as AggregationCursor<T>;
  }
}
