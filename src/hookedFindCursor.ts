import type { FindCursor, Document, CountOptions, Filter } from "mongodb";
import { CallerType, Events, HookedEventEmitter, InternalEvents, assertCaller, HookedFindCursorInterface, FindCursorHookedEventMap, MaybeStrictFilter, ChainedCallbackEventMapWithCaller } from "./events/index.js";
import { AbstractHookedFindCursor } from "./abstractFindCursorImpl.js";
import { getTryCatch } from "./tryCatchEmit.js";
import { StandardInvokeHookOptions } from "./awaiatableEventEmitter.js";
import { BeforeAfterErrorFindCursorEventDefinitions } from "./events/findCursorEvents.js";
import { ExternalBeforeAfterEvent } from "./events/collectionEvents.js";
import { BeforeAfterCallbackArgsAndReturn, CommonDefinition, ExtractStandardBeforeAfterEventDefinitions, KeysMatching, Merge } from "./events/helpersTypes.js";
import { BeforeAfterErrorSharedEventDefinitions } from "./events/sharedEvents.js";

export interface HookedFindCursorOptions<TSchema> {
  transform?: (doc: TSchema) => any,
  ee: HookedEventEmitter<FindCursorHookedEventMap<TSchema>>,
  invocationSymbol: symbol,
  interceptExecute: boolean,
  invocationOptions?: StandardInvokeHookOptions<FindCursorHookedEventMap<TSchema>>
}
export class HookedFindCursor<
  TSchema = any,
  CollectionSchema extends Document = Document
> extends AbstractHookedFindCursor<TSchema> implements HookedFindCursorInterface<TSchema> {
  #transform?:(doc: TSchema) => any;
  #ee: HookedEventEmitter<FindCursorHookedEventMap<TSchema>>;
  #findInvocationSymbol: symbol;
  #currentInvocationSymbol: symbol;
  #caller: CallerType<"find.cursor.asyncIterator" | "find.cursor.forEach" | "find.cursor.toArray"  | "find.cursor.count" | "find.cursor.execute" | "find.cursor.next" | "find.cursor.close">;
  #cursor: FindCursor<TSchema>;
  #filter: MaybeStrictFilter<CollectionSchema>;
  #interceptExecute: boolean;
  #tryCatchEmit = getTryCatch<BeforeAfterErrorFindCursorEventDefinitions<TSchema>>();
  protected __tryCatchEmit = this.#tryCatchEmit;
  #invocationOptions?: StandardInvokeHookOptions<FindCursorHookedEventMap<TSchema>>;

  constructor(filter: MaybeStrictFilter<CollectionSchema> | undefined, findCursor: FindCursor<TSchema>, {
    transform,
    ee,
    invocationSymbol,
    interceptExecute = false,
    invocationOptions
  }: HookedFindCursorOptions<TSchema>) {
    super(findCursor);
    this.#transform = transform;
    this.#cursor = findCursor;
    this.#filter = filter || {};
    this.#findInvocationSymbol = invocationSymbol;
    this.#currentInvocationSymbol = invocationSymbol;
    this.#invocationOptions = invocationOptions;
    this.#ee = ee;
    this.#interceptExecute = interceptExecute;
  }

  // exposed for testing only
  get ee() {
    return this.#ee;
  }


  filter(filter: Filter<CollectionSchema>): this {
    this.#cursor.filter(filter);
    this.#filter = filter;
    return this;
  }

  addFilter(filter: Filter<CollectionSchema>) {
    return this.filter({
      $and: [this.#filter as Filter<CollectionSchema>, filter]
    });
  }

  close() {
    return this.#tryCatchEmit(
      this.#ee,
      () => this.#cursor.close(),
      undefined,
      undefined,
      {
        parentInvocationSymbol: this.#findInvocationSymbol,
        thisArg: this
      },
      false,
      false,
      undefined,
      this.#invocationOptions,
      "find.cursor.close",
      {
        event: InternalEvents["cursor.close"],
        emitArgs: {
          operation: "find.cursor.close"
        }
      }
    );
  }

  rewind() {
    const invocationSymbol = Symbol("find.cursor.rewind");
    this.#ee.callAllSync(
      {
        invocationSymbol,
        parentInvocationSymbol: this.#findInvocationSymbol,
        signal: this.#invocationOptions?.signal,
        thisArg: this,
      },
      this.#invocationOptions,
      Events.before["find.cursor.rewind"],
      {
        event: Events.before["cursor.rewind"],
        emitArgs: {
          operation: "find.cursor.rewind"
        }
      }
    );

    try {
      this.#cursor.rewind();
      this.#ee.callAllSync(
        {
          thisArg: this,
          parentInvocationSymbol: this.#findInvocationSymbol,
          signal: this.#invocationOptions?.signal,
          invocationSymbol
        },
        this.#invocationOptions,
        Events.afterSuccess["find.cursor.rewind"],
        Events.after["find.cursor.rewind"],
        {
          event: Events.afterSuccess["cursor.rewind"],
          emitArgs: {
            operation: "find.cursor.rewind"
          }
        },
        {
          event: Events.after["cursor.rewind"],
          emitArgs: {
            operation: "find.cursor.rewind"
          }
        }
      );
      return;
    }
    catch (e) {
      this.#ee.callAllSync(
        {
          error: e,
          thisArg: this,
          parentInvocationSymbol: this.#findInvocationSymbol,
          signal: this.#invocationOptions?.signal,
          invocationSymbol
        },
        this.#invocationOptions,
        Events.afterError["find.cursor.rewind"],
        Events.after["find.cursor.rewind"],
        {
          event: Events.afterError["cursor.rewind"],
          emitArgs: {
            operation: "find.cursor.rewind"
          }
        },
        {
          event: Events.after["cursor.rewind"],
          emitArgs: {
            operation: "find.cursor.rewind"
          }
        }
      );
      throw e;
    }
  }

  async #triggerInit() {
    return this.#tryCatchEmit(
      this.#ee,
      async () => {
        const invocationSymbol = Symbol("find.cursor.execute");
        assertCaller(this.#caller, "find.cursor.execute");
        await this.#ee.callAllAwaitableInParallel(
          {
            caller: this.#caller,
            parentInvocationSymbol: this.#currentInvocationSymbol,
            signal: this.#invocationOptions?.signal,
            thisArg: this,
            invocationSymbol
          },
          this.#invocationOptions,
          Events.before["find.cursor.execute"],
          {
            event: Events.before["cursor.execute"],
            emitArgs: {
              operation: "find.cursor.execute"
            }
          }
        );
        try {
          if (this.#interceptExecute) {
            await new Promise((resolve, reject) => {
              // @ts-expect-error Naughty naughty. We need to manually init the cursor if we want to know what causes an execution - maybe we don't care
              this.#cursor._initialize((err, state) => {
                if (err) {
                  reject(err);
                }
                else {
                  resolve(state);
                }
              });
            });
          }
          await this.#ee.callAllAwaitableInParallel(
            {
              caller: this.#caller,
              parentInvocationSymbol: this.#currentInvocationSymbol,
              signal: this.#invocationOptions?.signal,
              thisArg: this,
              invocationSymbol
            },
            this.#invocationOptions,
            Events.afterSuccess["find.cursor.execute"],
            Events.after["find.cursor.execute"],
            {
              event: Events.afterSuccess["cursor.execute"],
              emitArgs: {
                operation: "find.cursor.execute"
              }
            },
            {
              event: Events.after["cursor.execute"],
              emitArgs: {
                operation: "find.cursor.execute"
              }
            },
          );
        }
        catch (error) {
          await this.#ee.callAllAwaitableInParallel(
            {
              caller: this.#caller,
              parentInvocationSymbol: this.#currentInvocationSymbol,
              signal: this.#invocationOptions?.signal,
              thisArg: this,
              invocationSymbol,
              error
            },
            this.#invocationOptions,
            Events.afterError["find.cursor.execute"],
            Events.after["find.cursor.execute"],
            {
              event: Events.afterError["cursor.execute"],
              emitArgs: {
                operation: "find.cursor.execute"
              }
            },
            {
              event: Events.after["cursor.execute"],
              emitArgs: {
                operation: "find.cursor.execute"
              }
            }
          );
          throw error;
        }
      },
      this.#caller,
      [],
      {
        operation: "find.cursor.execute",
        parentInvocationSymbol: this.#findInvocationSymbol,
        thisArg: this
      },
      false,
      false,
      undefined,
      this.#invocationOptions,
      InternalEvents["*"],
    );
  }

  async #wrapCaller<T>(caller: CallerType<"find.cursor.asyncIterator" | "find.cursor.forEach" | "find.cursor.toArray"  | "find.cursor.count" | "find.cursor.execute" | "find.cursor.next">, fn: () => Promise<T>, invocationSymbol?: symbol): Promise<T> {
    try {
      this.#caller = caller;
      if (invocationSymbol) {
        this.#currentInvocationSymbol = invocationSymbol;
      }
      return await fn();
    }
    finally {
      this.#currentInvocationSymbol = this.#findInvocationSymbol;
    }
  }

  async next(): Promise<TSchema | null> {
    return this.#tryCatchEmit(
      this.#ee,
      () => {
        assertCaller(this.#caller, "find.cursor.next");
        return this.#tryCatchEmit(
          this.#ee,
          async ({ invocationSymbol }) => this.#wrapCaller("find.cursor.next", async () => {
            if (this.#cursor.id === undefined) {
              await this.#triggerInit();
            }
            let next: TSchema | null = await this.#cursor.next();

            if (this.#transform && next) {
              next = this.#transform(next);
            }
            return next;
          }, invocationSymbol),
          this.#caller,
          undefined,
          {
            parentInvocationSymbol: this.#currentInvocationSymbol,
            thisArg: this
          },
          false,
          true,
          undefined,
          this.#invocationOptions,
          InternalEvents["find.cursor.next"],
          {
            event: InternalEvents["cursor.next"],
            emitArgs: {
              operation: "find.cursor.next"
            }
          }
        )
      },
      this.#caller,
      [],
      {
        operation: "find.cursor.next",
        parentInvocationSymbol: this.#findInvocationSymbol,
        thisArg: this
      },
      false,
      false,
      undefined,
      this.#invocationOptions,
      InternalEvents["*"],
    );
  }

  map<T>(transform: (doc: TSchema) => T): HookedFindCursor<T> {
    // this looks weird, but it means you'll get a transform for the first map, but not subsequent ones
    // because map just returns the cursor, `a.map(() => {}); a.map(() => {})` and `a.map(() => {}).map(() => {})` are equivalent
    const _transform = this.#transform;
    this.#transform = undefined;
    return super.map<T>((doc) => transform(_transform ? _transform(doc) : doc)) as HookedFindCursor<T>;
  }

  async toArray(): Promise<TSchema[]> {
    return this.#tryCatchEmit(
      this.#ee,
      () => {
        assertCaller(this.#caller, "find.cursor.toArray");
        return this.#tryCatchEmit(
          this.#ee,
          ({ invocationSymbol }) => this.#wrapCaller("find.cursor.toArray", async () => {
            if (this.#cursor.id === undefined) {
              await this.#triggerInit();
            }
            const array = await this.#cursor.toArray();
            if (!array?.map || !this.#transform) {
              return array;
            }
            return array.map(doc => this.#transform ? this.#transform(doc) : doc);
          }, invocationSymbol),
          undefined,
          undefined,
          {
            parentInvocationSymbol: this.#currentInvocationSymbol,
            thisArg: this
          },
          false,
          true,
          undefined,
          this.#invocationOptions,
          InternalEvents["find.cursor.toArray"],
          {
            event: InternalEvents["cursor.toArray"],
            emitArgs: {
              operation: "find.cursor.toArray"
            }
          }
        );
      },
      this.#caller,
      [],
      {
        operation: "find.cursor.toArray",
        parentInvocationSymbol: this.#findInvocationSymbol,
        thisArg: this
      },
      false,
      false,
      undefined,
      this.#invocationOptions,
      InternalEvents["*"],
    );
  }

  async count(options?: CountOptions): Promise<number> {
    return this.#tryCatchEmit(
      this.#ee,
      () => {
        assertCaller(this.#caller, "find.cursor.count");
        return this.#tryCatchEmit(
          this.#ee,
          ({ beforeHooksResult: optionsToUse }) => this.#cursor.count(...optionsToUse),
          undefined,
          [options],
          {
            parentInvocationSymbol: this.#currentInvocationSymbol,
            thisArg: this
          },
          true,
          true,
          "args",
          this.#invocationOptions,
          "find.cursor.count"
        );
      },
      this.#caller,
      [options],
      {
        operation: "find.cursor.count",
        parentInvocationSymbol: this.#findInvocationSymbol,
        thisArg: this
      },
      false,
      false,
      undefined,
      this.#invocationOptions,
      InternalEvents["*"],
    );
  }

  async forEach(iterator: (doc: TSchema) => boolean | void): Promise<void> {
    return this.#tryCatchEmit(
      this.#ee,
      () => {
        assertCaller(this.#caller, "find.cursor.forEach");
        return this.#tryCatchEmit(
          this.#ee,
          ({ beforeHooksResult: [chainedIterator], invocationSymbol }) => this.#wrapCaller("find.cursor.forEach", async () => {
            if (this.#cursor.id === undefined) {
              await this.#triggerInit();
            }
            return this.#cursor.forEach((doc) => {
              const transformed = this.#transform ? this.#transform(doc) : doc;
              chainedIterator(transformed);
            });
          }, invocationSymbol),
          undefined,
          [iterator],
          {
            parentInvocationSymbol: this.#currentInvocationSymbol,
            thisArg: this
          },
          true,
          false,
          "args",
          this.#invocationOptions,
          "find.cursor.forEach",
          {
            event: "cursor.forEach",
            emitArgs: {
              operation: "find.cursor.forEach"
            }
          }
        );
      },
      this.#caller,
      [iterator],
      {
        operation: "find.cursor.forEach",
        thisArg: this,
        parentInvocationSymbol: this.#findInvocationSymbol,
      },
      false,
      false,
      undefined,
      this.#invocationOptions,
      InternalEvents["*"],
    );
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<TSchema, void, void> {
    const invocationSymbol = Symbol("find.cursor.asyncIterator");
    let started = false;
    let errored = false;
    await this.#ee.callAllAwaitableInParallel(
      {
        caller: "find",
        invocationSymbol,
        parentInvocationSymbol: this.#findInvocationSymbol,
        signal: this.#invocationOptions?.signal,
        operation: "find.cursor.asyncIterator",
        thisArg: this,
        args: []
      },
      this.#invocationOptions,
      "before.*"
    );
    await this.#ee.callAllAwaitableInParallel(
      {
        invocationSymbol,
        parentInvocationSymbol: this.#findInvocationSymbol,
        signal: this.#invocationOptions?.signal,
        thisArg: this
      },
      this.#invocationOptions,
      "before.find.cursor.asyncIterator",
      {
        event: "before.cursor.asyncIterator",
        emitArgs: {
          operation: "find.cursor.asyncIterator"
        }
      }
    );
    try {

      if (this.#cursor.id === undefined) {
        await this.#wrapCaller("find.cursor.asyncIterator", () => this.#triggerInit(), invocationSymbol);
      }
      const iterator = this.#cursor[Symbol.asyncIterator]();
      started = true;
      for await (const item of iterator) {
        if (this.#transform) {
          yield this.#transform(item);
        }
        else {
          yield item;
        }
      }
    }
    catch (e) {
      errored = true;
      await this.#ee.callAllAwaitableInParallel(
        {
          invocationSymbol,
          parentInvocationSymbol: this.#findInvocationSymbol,
          signal: this.#invocationOptions?.signal,
          thisArg: this,
          error: e
        },
        this.#invocationOptions,
        "after.find.cursor.asyncIterator.error",
        "after.find.cursor.asyncIterator",
        {
          event: "after.cursor.asyncIterator.error",
          emitArgs: {
            operation: "find.cursor.asyncIterator"
          }
        },
        {
          event: "after.cursor.asyncIterator",
          emitArgs: {
            operation: "find.cursor.asyncIterator"
          }
        }
      );

      await this.#ee.callAllAwaitableInParallel(
        {
          caller: "find",
          invocationSymbol,
          parentInvocationSymbol: this.#findInvocationSymbol,
          signal: this.#invocationOptions?.signal,
          operation: "find.cursor.asyncIterator",
          thisArg: this,
          args: [],
          error: e
        },
        this.#invocationOptions,
        "after.*.error",
        "after.*",
      );
      throw e;
    }
    finally {
      if (errored || !started) {
        return;
      }
      await this.#ee.callAllAwaitableInParallel(
        {
          invocationSymbol,
          parentInvocationSymbol: this.#findInvocationSymbol,
          signal: this.#invocationOptions?.signal,
          thisArg: this,
        },
        this.#invocationOptions,
        "after.find.cursor.asyncIterator.success",
        "after.find.cursor.asyncIterator",
        {
          event: "after.cursor.asyncIterator.success",
          emitArgs: {
            operation: "find.cursor.asyncIterator"
          }
        },
        {
          event: "after.cursor.asyncIterator",
          emitArgs: {
            operation: "find.cursor.asyncIterator"
          }
        }
      );

      await this.#ee.callAllAwaitableInParallel(
        {
          caller: "find",
          invocationSymbol,
          parentInvocationSymbol: this.#findInvocationSymbol,
          signal: this.#invocationOptions?.signal,
          operation: "find.cursor.asyncIterator",
          thisArg: this,
          args: [],
        },
        this.#invocationOptions,
        "after.*.success",
        "after.*",
      );
    }
  }

  clone(): HookedFindCursor<TSchema, CollectionSchema> {
    return new HookedFindCursor<TSchema, CollectionSchema>(this.#filter, this.#cursor.clone(), {
      invocationSymbol: this.#findInvocationSymbol,
      transform: this.#transform,
      ee: this.#ee,
      interceptExecute: this.#interceptExecute,
      invocationOptions: this.#invocationOptions
    });
  }
}


export class ExtendableHookedFindCursor<
  TSchema = any,
  CollectionSchema extends Document = Document,
  ExtraBeforeAfterEvents extends Record<string, ExternalBeforeAfterEvent<CommonDefinition & { result: any }>> = {},
  ExtraEvents extends ChainedCallbackEventMapWithCaller = BeforeAfterCallbackArgsAndReturn<ExtractStandardBeforeAfterEventDefinitions<ExtraBeforeAfterEvents>>,
  AllEvents extends ChainedCallbackEventMapWithCaller = Merge<FindCursorHookedEventMap<TSchema>, ExtraEvents>
> extends HookedFindCursor<TSchema, CollectionSchema> {
  #externalEE = this.ee as unknown as HookedEventEmitter<AllEvents>;


  protected async _tryCatchEmit<
    HEM extends AllEvents,
    // TODO: clean this up - ties into tryCatchEmit.ts
    T extends (callArgs: HEM[BE]["emitArgs"]["args"] extends never
      ? { invocationSymbol: symbol }
      : HEM[BE] extends { returns: any }
        ? { invocationSymbol: symbol, beforeHooksResult: HEM[BE]["returns"] }
        : { invocationSymbol: symbol }
        // TODO: support sync operations
      ) => Promise<HEM[AE]["emitArgs"]["result"]>,
    BE extends `before.${IE}` & keyof HEM,
    AE extends `after.${IE}` & keyof HEM,
    // dunno why & string is required here :shrug:
    IE extends keyof BeforeAfterErrorFindCursorEventDefinitions<TSchema> | keyof BeforeAfterErrorSharedEventDefinitions<TSchema extends Document ? TSchema : Document> | (KeysMatching<ExtraBeforeAfterEvents, { forCursor: true }> & string),
    // TODO: this is a bit of a hack. It stops us getting typeerrors on things like findOne*
    OIE extends keyof BeforeAfterErrorFindCursorEventDefinitions<TSchema> | keyof BeforeAfterErrorSharedEventDefinitions<TSchema extends Document ? TSchema : Document> | (KeysMatching<ExtraBeforeAfterEvents, { forCursor: true }> & string),

    EA extends HEM[BE]["emitArgs"],
    OEA extends Omit<EA, "invocationSymbol" | "thisArg" | "signal">
  > (
    internalEvent: IE,
    emitArgs: OEA,
    beforeChainKey: (keyof OEA & HEM[BE]["returnEmitName"]) | undefined,
    chainResults: HEM[AE]["returnEmitName"] extends never ? false : true,
    fn: T,
    invocationOptions: StandardInvokeHookOptions<AllEvents, `before.${IE}` | `after.${IE}.success`> | undefined,
    ...additionalInternalEvents: OIE[] | { event: OIE, emitArgs: Partial<HEM[`before.${OIE}`]["emitArgs"]> }[]
  ): Promise<Awaited<ReturnType<T>>> { // not sure why this isn't inferred - we get Promise<ReturnType<T>> instead, which fails when T returns a promise
    const { caller, args } = emitArgs;
    return this.__tryCatchEmit(
      this.#externalEE,
      fn,
      caller,
      args,
      // @ts-expect-error we're going to be opinionated that we shouldn't be passing in additional emit args
      {},
      beforeChainKey === undefined ? false : true,
      chainResults,
      beforeChainKey,
      invocationOptions,
      internalEvent,
      ...additionalInternalEvents
    );
  }
}
