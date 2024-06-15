import type { AggregationCursor } from "mongodb";
import { AggregationCursorHookedEventMap, CallerType, Events, HookedAggregationCursorInterface, HookedEventEmitter, InternalEvents, PartialCallbackMap, assertCaller } from "./events/index.js";
import { AbstractHookedAggregationCursor } from "./abstractAggregationCursorImpl.js";
import { StandardInvokeHookOptions } from "./awaiatableEventEmitter.js";
import { getTryCatch } from "./tryCatchEmit.js";
import { BeforeAfterErrorAggregateCursorEventDefinitions } from "./events/aggregationCursorEvents.js";


interface HookedAggregateCursorOptions<TSchema> {
  events: PartialCallbackMap<
    keyof AggregationCursorHookedEventMap<TSchema>,
    AggregationCursorHookedEventMap<TSchema>
  >,
  invocationSymbol: symbol,
  invocationOptions?: StandardInvokeHookOptions<AggregationCursorHookedEventMap<TSchema>>,
  interceptExecute: boolean
}

export class HookedAggregationCursor<TSchema extends unknown> extends AbstractHookedAggregationCursor<TSchema> implements HookedAggregationCursorInterface<TSchema> {
  #ee = new HookedEventEmitter<AggregationCursorHookedEventMap<TSchema>>();
  #aggregateInvocationSymbol: symbol;
  #currentInvocationSymbol: symbol;
  #caller: CallerType<"aggregation.cursor.asyncIterator" | "aggregation.cursor.forEach" | "aggregation.cursor.toArray"  | "aggregation.cursor.execute" | "aggregation.cursor.next"> = "aggregate";
  #cursor: AggregationCursor<TSchema>;
  #invocationOptions?: StandardInvokeHookOptions<AggregationCursorHookedEventMap<TSchema>>;
  #interceptExecute: boolean = false;
  #tryCatchEmit = getTryCatch<BeforeAfterErrorAggregateCursorEventDefinitions<TSchema>>();
  constructor(cursor: AggregationCursor<TSchema>, {
    events,
    invocationSymbol,
    invocationOptions,
    interceptExecute
  }: HookedAggregateCursorOptions<TSchema>) {
    super(cursor);
    this.#cursor = cursor;
    this.#aggregateInvocationSymbol = invocationSymbol;
    this.#currentInvocationSymbol = invocationSymbol;
    this.#invocationOptions = invocationOptions;
    this.#interceptExecute = interceptExecute;
    Object.entries(events).forEach(([name, listeners]) => {
      listeners.forEach(({ listener, options }) => {
        this.#ee.addListener(
          name as keyof AggregationCursorHookedEventMap<any>,
          listener,
          options
        );
      });
    });
  }

  // exposed for testing only
  get ee() {
    return this.#ee;
  }

  async #triggerInit() {
    return this.#tryCatchEmit(
      this.#ee,
      async () => {
        const invocationSymbol = Symbol("aggregation.cursor.execute");
        assertCaller(this.#caller, "aggregation.cursor.execute");
        await this.#ee.callAllAwaitableInParallel(
          {
            caller: this.#caller,
            parentInvocationSymbol: this.#currentInvocationSymbol,
            thisArg: this,
            invocationSymbol
          },
          this.#invocationOptions,
          Events.before["aggregation.cursor.execute"],
          Events.before["cursor.execute"]
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
              thisArg: this,
              invocationSymbol
            },
            this.#invocationOptions,
            Events.afterSuccess["aggregation.cursor.execute"],
            Events.afterSuccess["cursor.execute"]
          );
        }
        catch (error) {
          await this.#ee.callAllAwaitableInParallel(
            {
              caller: this.#caller,
              parentInvocationSymbol: this.#currentInvocationSymbol,
              thisArg: this,
              invocationSymbol,
              error
            },
            this.#invocationOptions,
            Events.afterError["aggregation.cursor.execute"],
            Events.afterError["cursor.execute"]
          );
          throw error;
        }
      },
      this.#caller,
      [],
      {
        operation: "aggregation.cursor.execute",
        parentInvocationSymbol: this.#aggregateInvocationSymbol,
        thisArg: this
      },
      false,
      false,
      undefined,
      this.#invocationOptions,
      InternalEvents["*"],
    );
  }

  async next(): Promise<TSchema | null> {
    return this.#tryCatchEmit(
      this.#ee,
      async () => {
        assertCaller(this.#caller, "aggregation.cursor.next");
        const invocationSymbol = Symbol("aggregation.next");
        return this.#tryCatchEmit(
          this.#ee,
          async ({ invocationSymbol }) => this.#wrapCaller("aggregation.cursor.next", async () => {
            if (this.#cursor.id === undefined) {
              await this.#triggerInit();
            }
            let next: TSchema | null = await this.#cursor.next();

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
          InternalEvents["aggregation.cursor.next"],
          InternalEvents["cursor.next"]
        )
      },
      this.#caller,
      [],
      {
        operation: "aggregation.cursor.next",
        thisArg: this,
        parentInvocationSymbol: this.#aggregateInvocationSymbol,
      },
      false,
      false,
      undefined,
      this.#invocationOptions,
      InternalEvents["*"],
    );
  }

  async #wrapCaller<T>(
    caller: CallerType<"aggregation.cursor.asyncIterator" | "aggregation.cursor.forEach" | "aggregation.cursor.toArray"  | "aggregation.cursor.execute" | "aggregation.cursor.next">,
    fn: () => Promise<T>,
    invocationSymbol?: symbol): Promise<T> {
    try {
      this.#caller = caller;
      if (invocationSymbol) {
        this.#currentInvocationSymbol = invocationSymbol;
      }
      return await fn();
    }
    finally {
      this.#caller = "aggregate";
      this.#currentInvocationSymbol = this.#aggregateInvocationSymbol;
    }
  }

  async toArray(): Promise<TSchema[]> {
    return this.#tryCatchEmit(
      this.#ee,
      () => {
        assertCaller(this.#caller, "aggregation.cursor.toArray");
        return this.#tryCatchEmit(
          this.#ee,
          ({
            invocationSymbol
          }) => this.#wrapCaller("aggregation.cursor.toArray", async () => {
            if (this.#cursor.id === undefined) {
              await this.#triggerInit();
            }
            return this.#cursor.toArray();
          }, invocationSymbol),
          this.#caller,
          undefined,
          {
            parentInvocationSymbol: this.#aggregateInvocationSymbol,
            thisArg: this
          },
          false,
          true,
          undefined,
          this.#invocationOptions,
          InternalEvents["aggregation.cursor.toArray"],
          InternalEvents["cursor.toArray"],
        );
      },
      this.#caller,
      [],
      {
        operation: "aggregation.cursor.toArray",
        thisArg: this,
        parentInvocationSymbol: this.#aggregateInvocationSymbol,
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
        assertCaller(this.#caller, "aggregation.cursor.forEach");
        return this.#tryCatchEmit(
          this.#ee,
          ({ invocationSymbol, beforeHooksResult: [chainedIterator] }) => this.#wrapCaller("aggregation.cursor.forEach", async () => {
            if (this.#cursor.id === undefined) {
              await this.#triggerInit();
            }
            return this.#cursor.forEach(chainedIterator);
          }, invocationSymbol),
          this.#caller,
          [iterator],
          {
            parentInvocationSymbol: this.#aggregateInvocationSymbol,
            thisArg: this,
          },
          true,
          false,
          "args",
          this.#invocationOptions,
          "aggregation.cursor.forEach",
          "cursor.forEach"
        );
      },
      this.#caller,
      [iterator],
      {
        operation: "aggregation.cursor.forEach",
        thisArg: this,
        parentInvocationSymbol: this.#aggregateInvocationSymbol,
      },
      false,
      false,
      undefined,
      this.#invocationOptions,
      InternalEvents["*"],
    );
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<TSchema, void, void> {
    const invocationSymbol = Symbol("aggregation.cursor.asyncIterator");
    let started = false;
    let errored = false;
    await this.#ee.callAllAwaitableInParallel(
      {
        caller: "aggregate",
        invocationSymbol,
        parentInvocationSymbol: this.#aggregateInvocationSymbol,
        operation: "aggregation.cursor.asyncIterator",
        thisArg: this,
        args: []
      },
      this.#invocationOptions,
      "before.*"
    );
    await this.#ee.callAllAwaitableInParallel(
      {
        caller: "aggregate",
        invocationSymbol,
        parentInvocationSymbol: this.#aggregateInvocationSymbol,
        thisArg: this
      },
      this.#invocationOptions,
      "before.aggregation.cursor.asyncIterator",
      "before.cursor.asyncIterator"
    );
    try {
      if (this.#cursor.id === undefined) {
        await this.#wrapCaller("aggregation.cursor.asyncIterator", () => this.#triggerInit(), invocationSymbol);
      }
      const iterator = this.#cursor[Symbol.asyncIterator]();
      started = true;
      for await (const item of iterator) {
        yield item;
      }
    }
    catch (e) {
      errored = true;
      await this.#ee.callAllAwaitableInParallel(
        {
          caller: "aggregate",
          invocationSymbol,
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          thisArg: this,
          error: e
        },
        this.#invocationOptions,
        "after.aggregation.cursor.asyncIterator.error",
        "after.cursor.asyncIterator.error"
      );

      await this.#ee.callAllAwaitableInParallel(
        {
          caller: "aggregate",
          invocationSymbol,
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          operation: "aggregation.cursor.asyncIterator",
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
          caller: "aggregate",
          invocationSymbol,
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          thisArg: this
        },
        this.#invocationOptions,
        "after.aggregation.cursor.asyncIterator.success",
        "after.cursor.asyncIterator.success"
      );

      await this.#ee.callAllAwaitableInParallel(
        {
          caller: "aggregate",
          invocationSymbol,
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          operation: "aggregation.cursor.asyncIterator",
          thisArg: this,
          args: [],
        },
        this.#invocationOptions,
        "after.*.success",
        "after.*",
      );
    }
  }

  clone(): HookedAggregationCursor<TSchema> {
    return new HookedAggregationCursor<TSchema>(this.#cursor.clone(), {
      invocationSymbol: this.#aggregateInvocationSymbol,
      events: Object.fromEntries(
        this.#ee.eventNames()
        .map(name => [name, this.#ee.awaitableListeners(name)])
      ),
      interceptExecute: this.#interceptExecute,
      invocationOptions: this.#invocationOptions
    });
  }

  close() {
    return this.#tryCatchEmit(
      this.#ee,
      () => this.#cursor.close(),
      "aggregate",
      undefined,
      {
        parentInvocationSymbol: this.#aggregateInvocationSymbol,
        thisArg: this
      },
      false,
      false,
      undefined,
      this.#invocationOptions,
      "aggregation.cursor.close",
      "cursor.close"
    );
  }

  rewind() {
    const invocationSymbol = Symbol("aggregation.cursor.rewind");
    this.#ee.callAllSyncChain(
      {
        invocationSymbol,
        caller: "find",
        parentInvocationSymbol: this.#aggregateInvocationSymbol,
        thisArg: this,
      },
      this.#invocationOptions,
      Events.before["aggregation.cursor.rewind"],
      Events.before["cursor.rewind"]
    );

    try {
      this.#cursor.rewind();
      this.#ee.callAllSyncChain(
        {
          thisArg: this,
          caller: "find",
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          invocationSymbol
        },
        this.#invocationOptions,
        Events.afterSuccess["aggregation.cursor.rewind"],
        Events.afterSuccess["cursor.rewind"],
      );
      return;
    }
    catch (e) {
      this.#ee.callAllSyncChain(
        {
          error: e,
          thisArg: this,
          caller: "find",
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          invocationSymbol
        },
        this.#invocationOptions,
        Events.afterError["aggregation.cursor.rewind"],
        Events.afterError["cursor.rewind"],
      );
      throw e;
    }
  }
}
