import type { MongoDBNamespace, ReadConcern, ReadPreference, AbstractCursor, AbstractCursorEvents, CommonEvents, CursorStreamOptions, GenericListener, Long, ReadConcernLike, ReadPreferenceLike } from "mongodb";

export abstract class AbstractHookedCursor<TSchema> implements AbstractCursor<TSchema> {
  #cursor: AbstractCursor<TSchema>

  constructor(cursor: AbstractCursor<TSchema>) {
    this.#cursor = cursor;
  }

  get id(): Long | undefined {
    return this.#cursor.id;
  }
  get namespace(): MongoDBNamespace {
    return this.#cursor.namespace;
  }
  get closed(): boolean {
    return this.#cursor.closed;
  }
  get killed(): boolean {
    return this.#cursor.killed;
  }
  get loadBalanced(): boolean {
    return this.#cursor.loadBalanced;
  }
  get readConcern(): ReadConcern | undefined {
    return this.#cursor.readConcern;
  }
  get readPreference(): ReadPreference {
    return this.#cursor.readPreference;
  }

  withReadConcern(readConcern: ReadConcernLike): this {
    this.#cursor.withReadConcern(readConcern);
    return this;
  }
  withReadPreference(readPreference: ReadPreferenceLike): this {
    this.#cursor.withReadPreference(readPreference);
    return this;
  }

  hasNext(): Promise<boolean> {
    return this.#cursor.hasNext();
  }
  readBufferedDocuments(number?: number | undefined): any[] {
    return this.#cursor.readBufferedDocuments(number);
  }
  stream(options?: CursorStreamOptions | undefined) {
    return this.#cursor.stream(options);
  }
  tryNext(): Promise<any> {
    return this.#cursor.tryNext();
  }

  addCursorFlag(flag: "tailable" | "oplogReplay" | "noCursorTimeout" | "awaitData" | "exhaust" | "partial", value: boolean): this {
    this.#cursor.addCursorFlag(flag, value);
    return this;
  }
  batchSize(value: number): this {
    this.#cursor.batchSize(value);
    return this;
  }
  bufferedCount(): number {
    return this.#cursor.bufferedCount()
  }
  close(): Promise<void> {
    return this.#cursor.close();
  }



  emit<EventKey extends "close">(event: symbol | EventKey, ...args: Parameters<AbstractCursorEvents[EventKey]>): boolean {
    return this.#cursor.emit(event, ...args);
  }
  eventNames(): string[] {
    return this.#cursor.eventNames();
  }
  getMaxListeners(): number {
    return this.#cursor.getMaxListeners();
  }
  listenerCount<EventKey extends "close">(type: string | symbol | EventKey): number {
    return this.#cursor.listenerCount(type);
  }
  listeners<EventKey extends "close">(event: string | symbol | EventKey): AbstractCursorEvents[EventKey][] {
    return this.#cursor.listeners(event);
  }
  addListener<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  addListener(event: CommonEvents, listenerName: (eventName: string | symbol, listener: GenericListener) => void): this;
  addListener(event: string | symbol, listener: GenericListener): this {
    this.#cursor.addListener(event, listener);
    return this;
  }
  off<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  off(event: CommonEvents, listenerName: (eventName: string | symbol, listener: GenericListener) => void): this;
  off(event: string | symbol, listener: GenericListener): this {
    this.#cursor.off(event, listener);
    return this;
  }
  on<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  on(event: CommonEvents, listenerName: (eventName: string | symbol, listener: GenericListener) => void): this;
  on(event: string | symbol, listener: GenericListener): this {
    this.#cursor.on(event, listener);
    return this;
  }
  once<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  once(event: CommonEvents, listenerName: (eventName: string | symbol, listener: GenericListener) => void): this;
  once(event: string | symbol, listener: GenericListener): this {
    this.#cursor.once(event, listener);
    return this;
  }
  prependListener<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  prependListener(event: CommonEvents, listenerName: (eventName: string | symbol, listener: GenericListener) => void): this;
  prependListener(event: string | symbol, listener: GenericListener): this {
    this.#cursor.prependListener(event, listener);
    return this;
  }
  prependOnceListener<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  prependOnceListener(event: CommonEvents, listenerName: (eventName: string | symbol, listener: GenericListener) => void): this;
  prependOnceListener(event: string | symbol, listener: GenericListener): this {
    this.#cursor.prependOnceListener(event, listener);
    return this;
  }
  rawListeners<EventKey extends "close">(event: string | symbol | EventKey): AbstractCursorEvents[EventKey][] {
    return this.#cursor.rawListeners(event);
  }

  removeAllListeners<EventKey extends "close">(event?: string | symbol | EventKey | undefined): this {
    this.#cursor.removeAllListeners(event);
    return this;
  }
  removeListener<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  removeListener(event: CommonEvents, listenerName: (eventName: string | symbol, listener: GenericListener) => void): this;
  removeListener(event: string | symbol, listener: GenericListener): this{
    this.#cursor.removeListener(event, listener);
    return this;
  }
  setMaxListeners(n: number): this {
    this.#cursor.setMaxListeners(n);
    return this;
  }
  maxTimeMS(value: number): this {
    this.#cursor.maxTimeMS(value);
    return this;
  }

  abstract forEach(iterator: (doc: TSchema) => boolean | void): Promise<void>;

  abstract map<T = any>(transform: (doc: TSchema) => T): AbstractCursor<T, AbstractCursorEvents>;
  abstract clone(): AbstractCursor<TSchema, AbstractCursorEvents>;
  abstract next(): Promise<TSchema | null>;
  abstract rewind(): void
  abstract toArray(): Promise<TSchema[]>
  abstract [Symbol.asyncIterator](): AsyncGenerator<TSchema, void, void>;
}
