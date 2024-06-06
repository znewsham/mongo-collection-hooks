import { AggregationCursor } from "mongodb";
import type { AbstractCursorOptions, MongoClient, Document } from "mongodb";
import { Events, HookedEventEmitter } from "./events.js";
import { MongoDBCollectionNamespace } from "mongodb/lib/utils.js";

interface HookedAggregateCursorOptions extends AbstractCursorOptions {
  events: Record<string, []>,
  invocationSymbol: symbol,
}

export class HookedAggregationCursor<TSchema extends Document> extends AggregationCursor<TSchema> {
  #ee = new HookedEventEmitter<TSchema, any>();
  #aggregateInvocationSymbol: symbol;

  constructor(client: MongoClient, namespace: MongoDBCollectionNamespace, pipeline: Document[], {
    events,
    invocationSymbol,
    ...options
  }: HookedAggregateCursorOptions) {
    // @ts-expect-error
    super(client, namespace, pipeline, options);
    this.#aggregateInvocationSymbol = invocationSymbol
    Object.entries(events).forEach(([name, listeners]) => {
      listeners.forEach(listener => this.#ee.addListener(name, listener));
    });
  }

  _initialize(session, callback) {
    const invocationSymbol = Symbol();
    Promise.all([
      this.#ee.callAwaitableInParallel(
        Events.before["cursor.execute"],
        {
          caller: "aggregate",
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          thisArg: this,
          invocationSymbol
        }
      ),
      this.#ee.callAwaitableInParallel(
        Events.before["aggregate.cursor.execute"],
        {
          caller: "aggregate",
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          thisArg: this,
          invocationSymbol
        }
      )
    ])
    .then(() => {
      // @ts-expect-error
      super._initialize(session, async (error, state) => {
        await Promise.all([
          this.#ee.callAwaitableInParallel(
            Events.after["aggregate.cursor.execute"],
            {
              caller: "aggregate",
              parentInvocationSymbol: this.#aggregateInvocationSymbol,
              thisArg: this,
              invocationSymbol,
              error
            }
          ),
          this.#ee.callAwaitableInParallel(
            Events.after["aggregate.find.cursor.execute"],
            {
              caller: "find",
              parentInvocationSymbol: this.#aggregateInvocationSymbol,
              thisArg: this,
              invocationSymbol,
              error
            }
          )
        ]);
        callback(error, state);
      });
    });
  }

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
      next = await super.next();
      gotNext = true;
      next = await this.#ee.callAwaitableChainWithResult(
        Events.after["cursor.next"],
        {
          caller: "aggregate",
          result: next,
          thisArg: this,
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          invocationSymbol
        }
      )
      next = await this.#ee.callAwaitableChainWithResult(
        Events.after["aggregate.cursor.next"],
        {
          caller: "aggregate",
          result: next,
          thisArg: this,
          parentInvocationSymbol: this.#aggregateInvocationSymbol,
          invocationSymbol
        }
      )
    }
    catch (err) {
      if (!gotNext) {
        await Promise.all([
          this.#ee.callAwaitableInParallel(
            Events.after["cursor.next"],
            {
              caller: "aggregate",
              error: err,
              thisArg: this,
              parentInvocationSymbol: this.#aggregateInvocationSymbol,
              invocationSymbol
            },
          ),
          this.#ee.callAwaitableInParallel(
            Events.after["aggregate.cursor.next"],
            {
              caller: "aggregate",
              error: err,
              thisArg: this,
              parentInvocationSymbol: this.#aggregateInvocationSymbol,
              invocationSymbol
            },
          ),
        ]);
      }
      throw err;
    }
    return next;
  }
}
