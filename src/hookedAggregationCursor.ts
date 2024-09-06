import type { AggregationCursor } from "mongodb";
import { AggregateCursorEventsSet, CallerType, EventDefinitions, Events, HookedEventEmitter, HookedEventMap, InternalEvents, assertCaller } from "./events.js";
import { AbstractHookedAggregationCursor } from "./abstractAggregationCursorImpl.js";
import { ConvertCallbackArgsToArgs, ListenerCallback } from "./awaiatableEventEmitter.js";
import { tryCatchEmit } from "./tryCatchEmit.js";

interface HookedAggregateCursorOptions<TSchema> {
  events: Record<string, ListenerCallback<keyof HookedEventMap<TSchema, any> & typeof AggregateCursorEventsSet, ConvertCallbackArgsToArgs<HookedEventMap<TSchema, typeof this>>>[]>,
  invocationSymbol: symbol,
}

export class HookedAggregationCursor<TSchema extends unknown> extends AbstractHookedAggregationCursor<TSchema> {
  #ee = new HookedEventEmitter<HookedEventMap<TSchema, typeof this>>();
  #aggregateInvocationSymbol: symbol;
  #currentInvocationSymbol: symbol;
  #caller: CallerType<"aggregate.cursor.asyncIterator" | "aggregate.cursor.forEach" | "aggregate.cursor.toArray"  | "aggregate.cursor.execute" | "aggregate.cursor.next"> = "aggregate";
  #cursor: AggregationCursor<TSchema>;

  constructor(cursor: AggregationCursor<TSchema>, {
    events,
    invocationSymbol,
  }: HookedAggregateCursorOptions<TSchema>) {
    super(cursor);
    this.#cursor = cursor;
    this.#aggregateInvocationSymbol = invocationSymbol
    Object.entries(events).forEach(([name, listeners]) => {
      listeners.forEach(listener => this.#ee.addListener(name, listener));
    });
  }

  // _initialize(session, callback) {
  //   const invocationSymbol = Symbol();
  //   Promise.all([
  //     this.#ee.callAwaitableInParallel(
  //       Events.before["cursor.execute"],
  //       {
  //         caller: "aggregate",
  //         parentInvocationSymbol: this.#aggregateInvocationSymbol,
  //         thisArg: this,
  //         invocationSymbol
  //       }
  //     ),
  //     this.#ee.callAwaitableInParallel(
  //       Events.before["aggregate.cursor.execute"],
  //       {
  //         caller: "aggregate",
  //         parentInvocationSymbol: this.#aggregateInvocationSymbol,
  //         thisArg: this,
  //         invocationSymbol
  //       }
  //     )
  //   ])
  //   .then(() => {
  //     // @ts-expect-error
  //     super._initialize(session, async (error, state) => {
  //       const event = error ? Events.afterError["aggregate.cursor.execute"]
  //       await Promise.all([
  //         this.#ee.callAwaitableInParallel(
  //           Events.afterSuccess["aggregate.cursor.execute"],
  //           {
  //             caller: "aggregate",
  //             parentInvocationSymbol: this.#aggregateInvocationSymbol,
  //             thisArg: this,
  //             invocationSymbol,
  //           }
  //         ),
  //         this.#ee.callAwaitableInParallel(
  //           Events.afterSuccess["aggregate.find.cursor.execute"],
  //           {
  //             caller: "find",
  //             parentInvocationSymbol: this.#aggregateInvocationSymbol,
  //             thisArg: this,
  //             invocationSymbol
  //           }
  //         )
  //       ]);
  //       callback(error, state);
  //     });
  //   });
  // }

  async next(): Promise<TSchema | null> {
    const invocationSymbol = Symbol();
    await Promise.all([
      this.#ee.callAwaitableInParallel(
        Events.before["cursor.next"],
        {
          caller: "aggregate",
          parentInvocationSymbol: invocationSymbol,
          thisArg: this,
          invocationSymbol
        }
      ),
      this.#ee.callAwaitableInParallel(
        Events.before["aggregate.cursor.next"],
        {
          caller: "aggregate",
          parentInvocationSymbol: invocationSymbol,
          thisArg: this,
          invocationSymbol
        }
      )
    ]);
    let next: TSchema | null;
    let gotNext = false;
    try {
      next = await this.#cursor.next();
      gotNext = true;
      next = await this.#ee.callAllAwaitableChainWithKey(
        {
          caller: "aggregate",
          result: next,
          thisArg: this,
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          invocationSymbol
        },
        Events.afterSuccess["aggregate.cursor.next"],
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
          Events.afterError["aggregate.cursor.next"],
          Events.afterError["cursor.next"]
        );
      }
      throw err;
    }
    return next;
  }

  async #wrapCaller<T>(caller: CallerType<"aggregate.cursor.asyncIterator" | "aggregate.cursor.forEach" | "aggregate.cursor.toArray"  | "aggregate.cursor.execute" | "aggregate.cursor.next">, fn: () => Promise<T>, invocationSymbol?: symbol): Promise<T> {
    try {
      this.#caller = caller;
      if (invocationSymbol) {
        this.#currentInvocationSymbol = invocationSymbol;
      }
      return fn();
    }
    finally {
      this.#caller = "aggregate";
      this.#currentInvocationSymbol = this.#aggregateInvocationSymbol;
    }
  }

  async toArray(): Promise<TSchema[]> {
    assertCaller(this.#caller, "aggregate.cursor.toArray");
    return tryCatchEmit(
      this.#ee,
      () => this.#wrapCaller("aggregate.cursor.toArray", () => this.#cursor.toArray()),
      this.#caller,
      undefined,
      {
        parentInvocationSymbol: this.#currentInvocationSymbol,
        thisArg: this
      },
      false,
      true,
      undefined,
      InternalEvents["aggregate.cursor.toArray"],
      InternalEvents["cursor.toArray"],
    );
  }

  async forEach(iterator: (doc: TSchema) => boolean | void): Promise<void> {
    assertCaller(this.#caller, "aggregate.cursor.forEach");
    return tryCatchEmit(
      this.#ee,
      ({ beforeHooksResult: [chainedIterator] }) => this.#wrapCaller("aggregate.cursor.forEach", () => this.#cursor.forEach(chainedIterator)),
      this.#caller,
      [iterator],
      {
        parentInvocationSymbol: this.#currentInvocationSymbol,
        thisArg: this
      },
      true,
      false,
      "args",
      "aggregate.cursor.forEach",
      "cursor.forEach"
    );
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<TSchema, void, void> {
    const invocationSymbol = Symbol();
    await this.#ee.callAllAwaitableInParallel(
      {
        caller: "aggregate",
        invocationSymbol,
        parentInvocationSymbol: this.#aggregateInvocationSymbol,
        thisArg: this
      },
      "before.aggregate.cursor.asyncIterator",
      "before.cursor.asyncIterator"
    );
    try {
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
        "after.aggregate.cursor.asyncIterator.success",
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
        "after.aggregate.cursor.asyncIterator.error",
        "after.cursor.asyncIterator.error"
      );
    }
  }

  clone(): HookedAggregationCursor<TSchema> {
    return new HookedAggregationCursor<TSchema>(this.#cursor.clone(), {
      invocationSymbol: this.#aggregateInvocationSymbol,
      events: Object.fromEntries(
        (this.#ee.eventNames() as string[])
        .map(name => [name, this.#ee.listeners(name)])
      )
    });
  }

  rewind(): void {
    this.#cursor.rewind();
  }
}
