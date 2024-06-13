import type { AggregationCursor } from "mongodb";
import { AggregationCursorHookedEventMap, CallerType, Events, HookedAggregationCursorInterface, HookedEventEmitter, InternalEvents, PartialCallbackMap, assertCaller } from "./events/index.js";
import { AbstractHookedAggregationCursor } from "./abstractAggregationCursorImpl.js";
import { StandardInvokeHookOptions } from "./awaiatableEventEmitter.js";
import { tryCatchEmit } from "./tryCatchEmit.js";


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
      listeners.forEach(listener => this.#ee.addListener(
        name as keyof AggregationCursorHookedEventMap<any>,
        listener
      ));
    });
  }

  async #triggerInit() {
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
  }

  async next(): Promise<TSchema | null> {
    const invocationSymbol = Symbol("aggregation.next");
    await this.#ee.callAllAwaitableInParallel(
      {
        caller: "aggregate",
        parentInvocationSymbol: this.#currentInvocationSymbol,
        thisArg: this,
        invocationSymbol
      },
      this.#invocationOptions,
      Events.before["aggregation.cursor.next"],
      Events.before["cursor.next"],
    );
    let next: TSchema | null;
    let gotNext = false;
    try {
      if (this.#cursor.id === undefined) {
        await this.#wrapCaller("aggregation.cursor.next", () => this.#triggerInit(), invocationSymbol);
      }
      next = await this.#cursor.next();
      gotNext = true;
      next = await this.#ee.callAllAwaitableChainWithKey(
        {
          caller: "aggregate",
          result: next,
          thisArg: this,
          parentInvocationSymbol: this.#currentInvocationSymbol,
          invocationSymbol
        },
        "result",
        this.#invocationOptions,
        Events.afterSuccess["aggregation.cursor.next"],
        Events.afterSuccess["cursor.next"]
      );
    }
    catch (err) {
      if (!gotNext) {
        await this.#ee.callAllAwaitableInParallel(
          {
            caller: "aggregate",
            error: err,
            thisArg: this,
            parentInvocationSymbol: this.#aggregateInvocationSymbol,
            invocationSymbol
          },
          this.#invocationOptions,
          Events.afterError["aggregation.cursor.next"],
          Events.afterError["cursor.next"]
        );
      }
      throw err;
    }
    return next;
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
    assertCaller(this.#caller, "aggregation.cursor.toArray");
    return tryCatchEmit(
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
      undefined,
      undefined,
      InternalEvents["aggregation.cursor.toArray"],
      InternalEvents["cursor.toArray"],
    );
  }

  async forEach(iterator: (doc: TSchema) => boolean | void): Promise<void> {
    assertCaller(this.#caller, "aggregation.cursor.forEach");
    return tryCatchEmit(
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
      undefined,
      undefined,
      "aggregation.cursor.forEach",
      "cursor.forEach"
    );
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<TSchema, void, void> {
    const invocationSymbol = Symbol("aggregation.cursor.asyncIterator");
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
      for await (const item of iterator) {
        yield item;
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
    }
    catch (e) {
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

  rewind(): void {
    this.#cursor.rewind();
  }
}
