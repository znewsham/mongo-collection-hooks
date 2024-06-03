import { FindCursor } from "mongodb";
import type { AbstractCursorOptions, MongoClient, Document } from "mongodb";
import { Events, HookedEventEmitter } from "./events.js";
import { MongoDBCollectionNamespace } from "mongodb/lib/utils.js";

interface HookedFindCursorOptions<TSchema extends Document, U extends any> extends AbstractCursorOptions {
  transform?(doc: TSchema): U
  events?: Record<string, []>
}

export class HookedFindCursor<TSchema extends Document, U extends any = any> extends FindCursor<TSchema> {
  #transform?:(doc: TSchema) => U;
  #ee = new HookedEventEmitter<TSchema, U>();
  #initialized = false;
  #parentInvocationSymbol = Symbol();
  #filter: Document;

  constructor(client: MongoClient, namespace: MongoDBCollectionNamespace, filter: Document, {
    transform,
    events,
    ...options
  }: HookedFindCursorOptions<TSchema, U> = {}) {
    // @ts-expect-error
    super(client, namespace, filter, options);
    this.#filter = filter;
    this.#transform = transform;
    if (events) {
      Object.entries(events).forEach(([name, listeners]) => {
        listeners.forEach(listener => this.#ee.addListener(name, listener));
      });
    }
  }

  filter(filter: Document) {
    super.filter(filter);
    this.#filter = filter;
    return this;
  }

  addFilter(filter: Document) {
    return this.filter({
      $and: [this.#filter, filter]
    });
  }

  _initialize(session, callback) {
    const invocationSymbol = Symbol();
    Promise.all([
      this.#ee.callAwaitableInParallel(
        Events.before["cursor.execute"],
        {
          caller: "find.cursor.execute",
          parentInvocationSymbol: this.#parentInvocationSymbol,
          thisArg: this,
          invocationSymbol
        }
      ),
      this.#ee.callAwaitableInParallel(
        Events.before["find.cursor.execute"],
        {
          caller: "find.cursor.execute",
          parentInvocationSymbol: this.#parentInvocationSymbol,
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
            Events.after["cursor.execute"],
            {
              caller: "find.cursor.execute",
              parentInvocationSymbol: this.#parentInvocationSymbol,
              thisArg: this,
              invocationSymbol,
              error
            }
          ),
          this.#ee.callAwaitableInParallel(
            Events.after["find.cursor.execute"],
            {
              caller: "find.cursor.execute",
              parentInvocationSymbol: this.#parentInvocationSymbol,
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

  // @ts-expect-error
  async next(): Promise<U | TSchema | null> {
    const invocationSymbol = Symbol();
    // let runInit = false;
    // if (!this.#initialized) {
    //   this.#initialized = true;
    //   runInit = true;
    //   await emitAndWait(
    //     this.#ee,
    //     Events.before["cursor.execute"],
    //     {
    //       thisArg: this,
    //       invocationSymbol: Symbol()
    //     }
    //   );
    //   await emitAndWait(
    //     this.#ee,
    //     Events.before["find.cursor.execute"],
    //     {
    //       thisArg: this,
    //       invocationSymbol: Symbol()
    //     }
    //   );
    // }
    await Promise.all([
      this.#ee.callAwaitableInParallel(
        Events.before["cursor.next"],
        {
          caller: "find.cursor.execute",
          parentInvocationSymbol: invocationSymbol,
          thisArg: this,
          invocationSymbol
        }
      ),
      this.#ee.callAwaitableInParallel(
        Events.before["find.cursor.next"],
        {
          caller: "find.cursor.execute",
          parentInvocationSymbol: invocationSymbol,
          thisArg: this,
          invocationSymbol
        }
      )
    ]);
    let next: TSchema | U | null;
    let gotNext = false;
    try {
      next = await super.next();

      if (this.#transform && next) {
        next = this.#transform(next);
      }
      gotNext = true;
      next = await this.#ee.callAwaitableChainWithResult(
        Events.after["cursor.next"],
        {
          caller: "find.cursor.execute",
          result: next,
          thisArg: this,
          parentInvocationSymbol: this.#parentInvocationSymbol,
          invocationSymbol
        }
      )
      next = await this.#ee.callAwaitableChainWithResult(
        Events.after["find.cursor.next"],
        {
          caller: "find.cursor.execute",
          result: next,
          thisArg: this,
          parentInvocationSymbol: this.#parentInvocationSymbol,
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
              caller: "find.cursor.execute",
              error: err,
              thisArg: this,
              parentInvocationSymbol: this.#parentInvocationSymbol,
              invocationSymbol
            },
          ),
          this.#ee.callAwaitableInParallel(
            Events.after["find.cursor.next"],
            {
              caller: "find.cursor.execute",
              error: err,
              thisArg: this,
              parentInvocationSymbol: this.#parentInvocationSymbol,
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
