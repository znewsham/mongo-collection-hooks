import type { FindCursor, Document, CountOptions } from "mongodb";
import { CallerType, Events, FindCursorEventsSet, HookedEventEmitter, HookedEventMap, InternalEvents, assertCaller } from "./events.js";
import { ConvertCallbackArgsToArgs, ListenerCallback } from "./awaiatableEventEmitter.js";
import { AbstractHookedFindCursor } from "./abstractFindCursorImpl.js";
import { tryCatchEmit } from "./tryCatchEmit.js";

interface HookedFindCursorOptions<TSchema> {
  transform?(doc: TSchema): any
  events: Record<string, ListenerCallback<keyof HookedEventMap<any, any> & typeof FindCursorEventsSet, ConvertCallbackArgsToArgs<HookedEventMap<TSchema, typeof this>>>[]>,
  invocationSymbol: symbol,
  interceptExecute: boolean
}

export class HookedFindCursor<TSchema> extends AbstractHookedFindCursor<TSchema>  implements FindCursor<TSchema> {
  #transform?:(doc: TSchema) => any;
  #ee = new HookedEventEmitter<HookedEventMap<TSchema, typeof this>>();
  #findInvocationSymbol: symbol;
  #currentInvocationSymbol: symbol;
  #caller: CallerType<"find.cursor.asyncIterator" | "find.cursor.forEach" | "find.cursor.toArray"  | "find.cursor.count" | "find.cursor.execute" | "find.cursor.next"> = "find";
  #cursor: FindCursor<TSchema>;
  #filter: Document;
  #interceptExecute: boolean;

  constructor(filter: Document | undefined, findCursor: FindCursor<TSchema>, {
    transform,
    events,
    invocationSymbol,
    interceptExecute = false,
  }: HookedFindCursorOptions<TSchema>) {
    super(findCursor);
    this.#transform = transform;
    this.#cursor = findCursor;
    this.#filter = filter || {};
    this.#findInvocationSymbol = invocationSymbol;
    this.#currentInvocationSymbol = invocationSymbol;
    Object.entries(events).forEach(([name, listeners]) => {
      listeners.forEach(listener => this.#ee.addListener(name, listener));
    });
    this.#interceptExecute = interceptExecute;
  }


  filter(filter: Document): this {
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
    return this.#cursor.rewind();
  }

  async #triggerInit() {
    const invocationSymbol = Symbol();
    await this.#ee.callAllAwaitableInParallel(
      {
        caller: this.#caller,
        parentInvocationSymbol: this.#currentInvocationSymbol,
        thisArg: this,
        invocationSymbol
      },
      Events.before["find.cursor.execute"],
      Events.before["cursor.execute"]
    );
    try {
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
      await this.#ee.callAllAwaitableInParallel(
        {
          caller: this.#caller,
          parentInvocationSymbol: this.#currentInvocationSymbol,
          thisArg: this,
          invocationSymbol
        },
        Events.afterSuccess["find.cursor.execute"],
        Events.afterSuccess["cursor.execute"]
      );
    }
    catch (error) {
      await this.#ee.callAllAwaitableInParallel(
        {
          caller: "find",
          parentInvocationSymbol: this.#currentInvocationSymbol,
          thisArg: this,
          invocationSymbol,
          error
        },
        Events.afterError["find.cursor.execute"],
        Events.afterError["cursor.execute"]
      );
      throw error;
    }
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
      this.#caller = "find";
      this.#currentInvocationSymbol = this.#findInvocationSymbol;
    }
  }

  async next(): Promise<TSchema | null> {
    assertCaller(this.#caller, "find.cursor.next");
    return tryCatchEmit(
      this.#ee,
      async ({ invocationSymbol }) => this.#wrapCaller("find.cursor.next", async () => {
        if (this.#cursor.id === undefined && this.#interceptExecute) {
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
      InternalEvents["find.cursor.next"],
      InternalEvents["cursor.next"]
    )
  }

  async toArray(): Promise<TSchema[]> {
    assertCaller(this.#caller, "find.cursor.toArray");
    return tryCatchEmit(
      this.#ee,
      ({ invocationSymbol }) => this.#wrapCaller("find.cursor.toArray", async () => {
        if (this.#cursor.id === undefined && this.#interceptExecute) {
          await this.#triggerInit();
        }
        return this.#cursor.toArray();
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
      InternalEvents["find.cursor.toArray"],
      InternalEvents["cursor.toArray"],
    );
  }

  async count(options?: CountOptions): Promise<number> {
    assertCaller(this.#caller, "find.cursor.count");
    return tryCatchEmit(
      this.#ee,
      ({ beforeHooksResult: optionsToUse }) => this.#cursor.count(...optionsToUse),
      this.#caller,
      [options],
      {
        parentInvocationSymbol: this.#currentInvocationSymbol,
        thisArg: this
      },
      true,
      true,
      "args",
      "find.cursor.count",
      InternalEvents["cursor.count"],
    );
  }

  async forEach(iterator: (doc: TSchema) => boolean | void): Promise<void> {
    assertCaller(this.#caller, "find.cursor.forEach");
    return tryCatchEmit(
      this.#ee,
      ({ beforeHooksResult: [chainedIterator], invocationSymbol }) => this.#wrapCaller("find.cursor.forEach", async () => {
        if (this.#cursor.id === undefined && this.#interceptExecute) {
          await this.#triggerInit();
        }
        return this.#cursor.forEach(chainedIterator);
      }, invocationSymbol),
      this.#caller,
      [iterator],
      {
        parentInvocationSymbol: this.#currentInvocationSymbol,
        thisArg: this
      },
      true,
      false,
      "args",
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

      if (this.#cursor.id === undefined && this.#interceptExecute) {
        await this.#wrapCaller("find.cursor.asyncIterator", () => this.#triggerInit(), invocationSymbol);
      }
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
        "after.find.cursor.asyncIterator.success",
        "after.cursor.asyncIterator.success"
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
        "after.find.cursor.asyncIterator.error",
        "after.cursor.asyncIterator.error"
      );
    }
  }

  clone(): HookedFindCursor<TSchema> {
    return new HookedFindCursor<TSchema>(this.#filter, this.#cursor.clone(), {
      invocationSymbol: this.#findInvocationSymbol,
      transform: this.#transform,
      events: Object.fromEntries(
        (this.#ee.eventNames() as string[])
        .map(name => [name, this.#ee.listeners(name)])
      ),
      interceptExecute: this.#interceptExecute
    });
  }
}
