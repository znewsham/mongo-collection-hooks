import type {
  Document,
  CollationOptions,
  ExplainVerbosityLike,
  FindCursor,
  Hint,
  Sort,
  SortDirection,
  CountOptions
} from "mongodb";
import { AbstractHookedCursor } from "./abstractCursorImpl.js";

export abstract class AbstractHookedFindCursor<TSchema> extends AbstractHookedCursor<TSchema> implements FindCursor<TSchema> {
  #cursor: FindCursor<TSchema>;
  constructor(cursor: FindCursor<TSchema>) {
    super(cursor);
    this.#cursor = cursor;
  }

  collation(value: CollationOptions): this {
    this.#cursor.collation(value);
    return this;
  };
  limit(value: number): this {
    this.#cursor.limit(value);
    return this;
  }
  skip(value: number): this {
    this.#cursor.skip(value);
    return this;
  };
  addQueryModifier(name: string, value: string | number | boolean | Document): this {
    this.#cursor.addQueryModifier(name, value);
    return this;
  }
  allowDiskUse(allow?: boolean | undefined): this {
    this.#cursor.allowDiskUse(allow);
    return this;
  }
  comment(value: string): this {
    this.#cursor.comment(value);
    return this;
  }
  explain(verbosity?: ExplainVerbosityLike | undefined): Promise<Document> {
    return this.#cursor.explain(verbosity);
  }
  hint(hint: Hint): this {
    this.#cursor.hint(hint);
    return this;
  }
  map<T>(transform: (doc: TSchema) => T): FindCursor<T> {
    this.#cursor.map(transform);
    return this as unknown as FindCursor<T>;
  }
  project<T extends Document = Document>(value: Document): FindCursor<T> {
    this.#cursor.project(value);
    return this as unknown as FindCursor<T>;
  }
  max(max: Document): this {
    this.#cursor.max(max);
    return this;
  }
  maxAwaitTimeMS(value: number): this {
    this.#cursor.maxAwaitTimeMS(value);
    return this;
  }
  min(min: Document): this {
    this.#cursor.min(min);
    return this;
  }
  maxTimeMS(value: number): this {
    this.#cursor.maxTimeMS(value);
    return this;
  }
  returnKey(value: boolean): this {
    this.#cursor.returnKey(value);
    return this;
  }
  showRecordId(value: boolean): this {
    this.#cursor.showRecordId(value);
    return this;
  }
  sort(sort: Sort, direction?: SortDirection | undefined): this {
    this.#cursor.sort(sort, direction);
    return this;
  }
  filter(filter: Document): this {
    this.#cursor.filter(filter);
    return this;
  }
  abstract count(options?: CountOptions): Promise<number>;
  abstract clone(): FindCursor<TSchema>;
}
