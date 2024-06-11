import type { FindCursor, Document, CountOptions } from "mongodb";
import { CallerType, Events, HookedEventEmitter, InternalEvents, PartialCallbackMap, assertCaller, HookedFindCursorInterface, FindCursorHookedEventMap } from "./events/index.js";
import { AbstractHookedFindCursor } from "./abstractFindCursorImpl.js";
import { tryCatchEmit } from "./tryCatchEmit.js";
import { StandardInvokeHookOptions } from "./awaiatableEventEmitter.js";

interface HookedFindCursorOptions<TSchema> {
  transform?: (doc: TSchema) => any,
  events: PartialCallbackMap<
    keyof FindCursorHookedEventMap<TSchema>,
    FindCursorHookedEventMap<TSchema>
  >,
  invocationSymbol: symbol,
  interceptExecute: boolean,
  invocationOptions?: StandardInvokeHookOptions<keyof FindCursorHookedEventMap<TSchema>, FindCursorHookedEventMap<TSchema>>
}
export class HookedFindCursor<TSchema extends any = any> extends AbstractHookedFindCursor<TSchema> implements HookedFindCursorInterface<TSchema> {
  #transform?:(doc: TSchema) => any;
  #ee = new HookedEventEmitter<FindCursorHookedEventMap<TSchema>>();
  #findInvocationSymbol: symbol;
  #currentInvocationSymbol: symbol;
  #caller: CallerType<"find.cursor.asyncIterator" | "find.cursor.forEach" | "find.cursor.toArray"  | "find.cursor.count" | "find.cursor.execute" | "find.cursor.next"> = "find";
  #cursor: FindCursor<TSchema>;
  #filter: Document;
  #interceptExecute: boolean;
  #invocationOptions?: StandardInvokeHookOptions<keyof FindCursorHookedEventMap<TSchema>, FindCursorHookedEventMap<TSchema>>;

  constructor(filter: Document | undefined, findCursor: FindCursor<TSchema>, {
    transform,
    events,
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
    Object.entries(events).forEach(([name, listeners]) => {
      listeners.forEach(listener => this.#ee.addListener(
        name as keyof FindCursorHookedEventMap<any>,
        listener
      ));
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
    assertCaller(this.#caller, "find.cursor.execute");
    await this.#ee.callAllAwaitableInParallel(
      {
        caller: this.#caller,
        parentInvocationSymbol: this.#currentInvocationSymbol,
        thisArg: this,
        invocationSymbol
      },
      this.#invocationOptions,
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
        this.#invocationOptions,
        Events.afterSuccess["find.cursor.execute"],
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
    this.#ee.awaitableListeners("before.find.cursor.next")
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
      this.#invocationOptions,
      undefined,
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
      this.#invocationOptions,
      undefined,
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
      this.#invocationOptions,
      undefined,
      undefined,
      "find.cursor.count"
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
      this.#invocationOptions,
      undefined,
      undefined,
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
      this.#invocationOptions,
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
        this.#invocationOptions,
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
        this.#invocationOptions,
        "after.find.cursor.asyncIterator.error",
        "after.cursor.asyncIterator.error"
      );
    }
  }

  clone(): HookedFindCursor<TSchema> {
    const eventNames = this.#ee.eventNames();
    return new HookedFindCursor<TSchema>(this.#filter, this.#cursor.clone(), {
      invocationSymbol: this.#findInvocationSymbol,
      transform: this.#transform,
      events: Object.fromEntries(
        eventNames
        .map(name => [name, this.#ee.awaitableListeners(name)])
      ),
      interceptExecute: this.#interceptExecute
    });
  }
}
