import { FindCursor } from "mongodb";
import type { Document, CountOptions, CollationOptions, AbstractCursorEvents, CommonEvents, GenericListener, Long, MongoDBNamespace, ReadConcern, ReadPreference, CursorStreamOptions, ReadConcernLike, ReadPreferenceLike, ExplainVerbosityLike, Hint, Sort, SortDirection } from "mongodb";
import { AfterEventNames, BeforeAfterEventDefinitions, BeforeAfterEventNames, BeforeEventNames, CallerType, EventNames, Events, FindCursorEventsSet, HookedEventEmitter, HookedEventMap, InternalEvents, assertCaller, internalSymbolToBeforeAfterKey } from "./events.js";
import { Readable } from "stream";
import { ConvertCallbackArgsToArgs, ListenerCallback } from "./awaiatableEventEmitter.js";

interface HookedFindCursorOptions<TSchema> {
  transform?(doc: TSchema): any
  events: Record<string, ListenerCallback<keyof HookedEventMap<any, any> & typeof FindCursorEventsSet, ConvertCallbackArgsToArgs<HookedEventMap<TSchema, typeof this>>>[]>,
  invocationSymbol: symbol,
}
export class HookedFindCursor<TSchema> implements FindCursor<TSchema> {
  #transform?:(doc: TSchema) => any;
  #ee = new HookedEventEmitter<HookedEventMap<TSchema, typeof this>>();
  #findInvocationSymbol: symbol;
  #currentInvocationSymbol: symbol;
  #caller: CallerType<"find.cursor.asyncIterator" | "find.cursor.forEach" | "find.cursor.toArray"  | "find.cursor.count" | "find.cursor.execute" | "find.cursor.next"> = "find";
  #cursor: FindCursor<TSchema>;
  #filter: Document;
  #initialized = false;

  constructor(filter: Document, findCursor: FindCursor<TSchema>, {
    transform,
    events,
    invocationSymbol,
  }: HookedFindCursorOptions<TSchema>) {
    this.#transform = transform;
    this.#cursor = findCursor;
    this.#filter = filter;
    this.#findInvocationSymbol = invocationSymbol;
    this.#currentInvocationSymbol = invocationSymbol;
    Object.entries(events).forEach(([name, listeners]) => {
      listeners.forEach(listener => this.#ee.addListener(name, listener));
    });
  }


  filter(filter: Document) {
    this.#cursor.filter(filter);
    this.#filter = filter;
    return this;
  }

  addFilter(filter: Document) {
    return this.filter({
      $and: [this.#filter, filter]
    });
  }

  rewind() {
    if (!this.#initialized) {
      return;
    }
    return this.#cursor.rewind();
  }

  _initialize(session: any, callback: (state: any, error: any) => {}) {
    const invocationSymbol = Symbol();
    this.#ee.callAllAwaitableInParallel(
      {
        caller: "find",
        parentInvocationSymbol: this.#findInvocationSymbol,
        thisArg: this,
        invocationSymbol
      },
      Events.before["cursor.execute"],
      Events.before["find.cursor.execute"]
    )
    .then(() => {
      // @ts-expect-error
      super._initialize(session, async (error, state) => {
        await this.#ee.callAllAwaitableInParallel(
          {
            caller: "find",
            parentInvocationSymbol: this.#findInvocationSymbol,
            thisArg: this,
            invocationSymbol,
            error
          },
          Events.after["cursor.execute"],
          Events.after["find.cursor.execute"]
        );
        callback(error, state);
      });
    });
  }

  async #wrapCaller<T>(caller: CallerType<"find.cursor.asyncIterator" | "find.cursor.forEach" | "find.cursor.toArray"  | "find.cursor.count" | "find.cursor.execute" | "find.cursor.next">, fn: () => Promise<T>, invocationSymbol?: symbol): Promise<T> {
    try {
      this.#caller = caller;
      if (invocationSymbol) {
        this.#currentInvocationSymbol = invocationSymbol;
      }
      return fn();
    }
    finally {
      this.#caller = "find";
      this.#currentInvocationSymbol = this.#findInvocationSymbol;
    }
  }

  async #tryCatchEmit<
    T extends (callArgs: { beforeHooksResult: BeforeAfterEventDefinitions<TSchema>[IE]["before"]["returns"] }) => Promise<any>,
    IE extends BeforeAfterEventNames<"find.cursor.count" | "find.cursor.toArray" | "find.cursor.next" | "find.cursor.forEach">
  >(
    fn: T,
    args: BeforeAfterEventDefinitions<TSchema>[IE]["before"]["args"],
    chainArgs: boolean = false,
    chainResult: boolean = false,
    internalEvent: IE,
    ...additionalInternalEvents: (keyof BeforeAfterEventDefinitions<TSchema>)[]
  ): Promise<Awaited<ReturnType<T>>> {
    assertCaller(this.#caller, internalEvent);
    const invocationSymbol = Symbol();
    const argsOrig = args;

    let chainedArgs = args;
    const {
      before: beforeEvent,
      after: afterEvent
    }: { before: BeforeEventNames, after: AfterEventNames } = internalSymbolToBeforeAfterKey(internalEvent);
    const additionalBeforeEvents = additionalInternalEvents.map(additionalInternalEvent => internalSymbolToBeforeAfterKey(additionalInternalEvent).before);
    const additionalAfterEvents = additionalInternalEvents.map(additionalInternalEvent => internalSymbolToBeforeAfterKey(additionalInternalEvent).after);
    if (chainArgs) {
      chainedArgs = await this.#ee.callAllAwaitableChainWithKey(
        {
          invocationSymbol,
          parentInvocationSymbol: this.#currentInvocationSymbol,
          ...(args && { args }),
          thisArg: this,
          caller: this.#caller,
        },
        "args",
        beforeEvent,
        ...additionalBeforeEvents
      );
    }
    else {
      await this.#ee.callAllAwaitableInParallel(
        {
          invocationSymbol,
          ...(args && { args }),
          parentInvocationSymbol: this.#currentInvocationSymbol,
          thisArg: this,
          caller: this.#caller
        },
        beforeEvent,
        ...additionalBeforeEvents
      );
    }
    let gotResult = false;
    try {
      let result = await fn({ beforeHooksResult: chainedArgs });
      gotResult = true;
      if (chainResult) {
        const chainedResult = await this.#ee.callAllAwaitableChainWithKey(
          {
            invocationSymbol,
            parentInvocationSymbol: this.#currentInvocationSymbol,
            thisArg: this,
            ...(args && { args }),
            ...(argsOrig && { argsOrig }),
            caller: this.#caller,
            result
          },
          "result",
          afterEvent,
          ...additionalAfterEvents
        );
        if (chainedResult !== undefined) {
          result = chainedResult;
        }
      }
      else {
        await this.#ee.callAllAwaitableInParallel(
          {
            invocationSymbol,
            parentInvocationSymbol: this.#currentInvocationSymbol,
            thisArg: this,
            ...(args && { args }),
            ...(argsOrig && { argsOrig }),
            caller: this.#caller,
            result
          },
          afterEvent,
          ...additionalAfterEvents
        );
      }
      return result;
    }
    catch (e) {
      if (!gotResult) {
        await this.#ee.callAllAwaitableInParallel(
          {
            invocationSymbol,
            parentInvocationSymbol: this.#findInvocationSymbol,
            thisArg: this,
            ...(args && { args }),
            ...(argsOrig && { argsOrig }),
            caller: this.#caller,
            error: e
          },
          afterEvent,
          ...additionalAfterEvents
        );
      }
      throw e;
    }
  }

  async next(): Promise<TSchema | null> {
    return this.#tryCatchEmit(
      async () => {
        let next: TSchema | null = await this.#cursor.next();

        if (this.#transform && next) {
          next = this.#transform(next);
        }
        return next;
      },
      undefined as never,
      false,
      true,
      InternalEvents["find.cursor.next"],
      InternalEvents["cursor.next"]
    )
  }

  async toArray(): Promise<TSchema[]> {
    return this.#tryCatchEmit(
      () => this.#wrapCaller("find.cursor.toArray", () => this.#cursor.toArray()),
      undefined as never,
      false,
      true,
      InternalEvents["find.cursor.toArray"],
      InternalEvents["cursor.toArray"],
    );
  }

  async count(options?: CountOptions): Promise<number> {
    return this.#tryCatchEmit(
      ({ beforeHooksResult: optionsToUse }) => this.#wrapCaller("find.cursor.count", () => this.#cursor.count(...optionsToUse)),
      [options],
      false,
      true,
      InternalEvents["find.cursor.count"],
      InternalEvents["cursor.count"],
    );
  }

  async forEach(iterator: (doc: TSchema) => boolean | void): Promise<void> {
    return this.#tryCatchEmit(
      ({ beforeHooksResult: [chainedIterator] }) => this.#wrapCaller("find.cursor.forEach", () => this.#cursor.forEach(chainedIterator)),
      [iterator],
      true,
      false,
      "find.cursor.forEach",
      "cursor.forEach"
    );
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<TSchema, void, void> {
    const invocationSymbol = Symbol();
    await this.#ee.callAllAwaitableInParallel(
      {
        caller: "find",
        invocationSymbol,
        parentInvocationSymbol: this.#findInvocationSymbol,
        thisArg: this
      },
      "before.find.cursor.asyncIterator",
      "before.cursor.asyncIterator"
    );
    try {
      const iterator = this.#cursor[Symbol.asyncIterator]();
      for await (const item of iterator) {
        yield item;
      }
      await this.#ee.callAllAwaitableInParallel(
        {
          caller: "find",
          invocationSymbol,
          parentInvocationSymbol: this.#findInvocationSymbol,
          thisArg: this,
        },
        "after.find.cursor.asyncIterator",
        "after.cursor.asyncIterator"
      );
    }
    catch (e) {
      await this.#ee.callAllAwaitableInParallel(
        {
          caller: "find",
          invocationSymbol,
          parentInvocationSymbol: this.#findInvocationSymbol,
          thisArg: this,
          error: e
        },
        "after.find.cursor.asyncIterator",
        "after.cursor.asyncIterator"
      );
    }
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
  get closed(): boolean {
    return this.#cursor.closed;
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
  hasNext(): Promise<boolean> {
    return this.#cursor.hasNext();
  }
  get id(): Long | undefined {
    return this.#cursor.id;
  }
  get killed(): boolean {
    return this.#cursor.killed;
  }
  listenerCount<EventKey extends "close">(type: string | symbol | EventKey): number {
    return this.#cursor.listenerCount(type);
  }
  listeners<EventKey extends "close">(event: string | symbol | EventKey): AbstractCursorEvents[EventKey][] {
    return this.#cursor.listeners(event);
  }
  get loadBalanced(): boolean {
    return this.#cursor.loadBalanced;
  }
  get namespace(): MongoDBNamespace {
    return this.#cursor.namespace;
  }
  addListener<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  addListener(event: CommonEvents, listener: (eventName: string | symbol, listener: GenericListener) => void): this;
  addListener(event: string | symbol, listener: GenericListener): this {
    this.#cursor.addListener(event, listener);
    return this;
  }
  off<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  off(event: CommonEvents, listener: (eventName: string | symbol, listener: GenericListener) => void): this;
  off(event: string | symbol, listener: GenericListener): this {
    this.#cursor.off(event, listener);
    return this;
  }
  on<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  on(event: CommonEvents, listener: (eventName: string | symbol, listener: GenericListener) => void): this;
  on(event: string | symbol, listener: GenericListener): this {
    this.#cursor.on(event, listener);
    return this;
  }
  once<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  once(event: CommonEvents, listener: (eventName: string | symbol, listener: GenericListener) => void): this;
  once(event: string | symbol, listener: GenericListener): this {
    this.#cursor.once(event, listener);
    return this;
  }
  prependListener<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  prependListener(event: CommonEvents, listener: (eventName: string | symbol, listener: GenericListener) => void): this;
  prependListener(event: string | symbol, listener: GenericListener): this {
    this.#cursor.prependListener(event, listener);
    return this;
  }
  prependOnceListener<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  prependOnceListener(event: CommonEvents, listener: (eventName: string | symbol, listener: GenericListener) => void): this;
  prependOnceListener(event: string | symbol, listener: GenericListener): this {
    this.#cursor.prependOnceListener(event, listener);
    return this;
  }
  rawListeners<EventKey extends "close">(event: string | symbol | EventKey): AbstractCursorEvents[EventKey][] {
    return this.#cursor.rawListeners(event);
  }
  readBufferedDocuments(number?: number | undefined): any[] {
    return this.#cursor.readBufferedDocuments(number);
  }
  get readConcern(): ReadConcern | undefined {
    return this.#cursor.readConcern;
  }
  get readPreference(): ReadPreference {
    return this.#cursor.readPreference;
  }
  removeAllListeners<EventKey extends "close">(event?: string | symbol | EventKey | undefined): this {
    this.#cursor.removeAllListeners(event);
    return this;
  }
  removeListener<EventKey extends "close">(event: EventKey, listener: AbstractCursorEvents[EventKey]): this;
  removeListener(event: CommonEvents, listener: (eventName: string | symbol, listener: GenericListener) => void): this;
  removeListener(event: string | symbol, listener: GenericListener): this{
    this.#cursor.removeListener(event, listener);
    return this;
  }
  setMaxListeners(n: number): this {
    this.#cursor.setMaxListeners(n);
    return this;
  }
  stream(options?: CursorStreamOptions | undefined): Readable & AsyncIterable<any> {
    return this.#cursor.stream();
  }
  tryNext(): Promise<any> {
    return this.#cursor.tryNext();
  }
  withReadConcern(readConcern: ReadConcernLike): this {
    this.#cursor.withReadConcern(readConcern);
    return this;
  }
  withReadPreference(readPreference: ReadPreferenceLike): this {
    this.#cursor.withReadPreference(readPreference);
    return this;
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
    return this.#cursor.explain();
  }
  hint(hint: Hint): this {
    this.#cursor.hint(hint);
    return this;
  }
  map<T>(transform: (doc: TSchema) => T): HookedFindCursor<T> {
    this.#cursor.map(transform);
    return this as unknown as HookedFindCursor<T>;
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
  project<T extends Document = Document>(value: Document): HookedFindCursor<T> {
    this.#cursor.project(value);
    return this as unknown as HookedFindCursor<T>;
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

  clone(): HookedFindCursor<TSchema> {
    return new HookedFindCursor<TSchema>(this.#filter, this.#cursor.clone(), {
      invocationSymbol: this.#findInvocationSymbol,
      transform: this.#transform,
      events: Object.fromEntries(
        (this.#ee.eventNames() as string[])
        .map(name => [name, this.#ee.listeners(name)])
      )
    });
  }
}
