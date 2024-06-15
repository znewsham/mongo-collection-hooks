import type { FindCursor, Document, CountOptions } from "mongodb";
import { CallerType, Events, HookedEventEmitter, InternalEvents, PartialCallbackMap, assertCaller, HookedFindCursorInterface, FindCursorHookedEventMap } from "./events/index.js";
import { AbstractHookedFindCursor } from "./abstractFindCursorImpl.js";
import { getTryCatch } from "./tryCatchEmit.js";
import { StandardInvokeHookOptions } from "./awaiatableEventEmitter.js";
import { BeforeAfterErrorFindCursorEventDefinitions } from "./events/findCursorEvents.js";

const t: PartialCallbackMap<
keyof FindCursorHookedEventMap<Document>,
FindCursorHookedEventMap<Document>
> = {
  "after.cursor.asyncIterator.error": [{
    listener: (() => void 0),
    options: {
      tags: ["test"]
    }
  }]
}

interface HookedFindCursorOptions<TSchema> {
  transform?: (doc: TSchema) => any,
  events: PartialCallbackMap<
    keyof FindCursorHookedEventMap<TSchema>,
    FindCursorHookedEventMap<TSchema>
  >,
  invocationSymbol: symbol,
  interceptExecute: boolean,
  invocationOptions?: StandardInvokeHookOptions<FindCursorHookedEventMap<TSchema>>
}
export class HookedFindCursor<TSchema extends any = any> extends AbstractHookedFindCursor<TSchema> implements HookedFindCursorInterface<TSchema> {
  #transform?:(doc: TSchema) => any;
  #ee = new HookedEventEmitter<FindCursorHookedEventMap<TSchema>>();
  #findInvocationSymbol: symbol;
  #currentInvocationSymbol: symbol;
  #caller: CallerType<"find.cursor.asyncIterator" | "find.cursor.forEach" | "find.cursor.toArray"  | "find.cursor.count" | "find.cursor.execute" | "find.cursor.next" | "find.cursor.close"> = "find";
  #cursor: FindCursor<TSchema>;
  #filter: Document;
  #interceptExecute: boolean;
  #tryCatchEmit = getTryCatch<BeforeAfterErrorFindCursorEventDefinitions<TSchema>>();
  #invocationOptions?: StandardInvokeHookOptions<FindCursorHookedEventMap<TSchema>>;

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
      listeners.forEach(({ listener, options }) => {
        this.#ee.addListener(
          name as keyof FindCursorHookedEventMap<any>,
          listener,
          options
        );
      });
    });
    this.#interceptExecute = interceptExecute;
  }

  // exposed for testing only
  get ee() {
    return this.#ee;
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

  close() {
    return this.#tryCatchEmit(
      this.#ee,
      () => this.#cursor.close(),
      "find",
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
      "cursor.close"
    );
  }

  rewind() {
    const invocationSymbol = Symbol("find.cursor.rewind");
    this.#ee.callAllSyncChain(
      {
        invocationSymbol,
        caller: "find",
        parentInvocationSymbol: this.#findInvocationSymbol,
        thisArg: this,
      },
      this.#invocationOptions,
      Events.before["find.cursor.rewind"],
      Events.before["cursor.rewind"]
    );

    try {
      this.#cursor.rewind();
      this.#ee.callAllSyncChain(
        {
          thisArg: this,
          caller: "find",
          parentInvocationSymbol: this.#findInvocationSymbol,
          invocationSymbol
        },
        this.#invocationOptions,
        Events.afterSuccess["find.cursor.rewind"],
        Events.after["find.cursor.rewind"],
        Events.afterSuccess["cursor.rewind"],
        Events.after["cursor.rewind"],
      );
      return;
    }
    catch (e) {
      this.#ee.callAllSyncChain(
        {
          error: e,
          thisArg: this,
          caller: "find",
          parentInvocationSymbol: this.#findInvocationSymbol,
          invocationSymbol
        },
        this.#invocationOptions,
        Events.afterError["find.cursor.rewind"],
        Events.after["find.cursor.rewind"],
        Events.afterError["cursor.rewind"],
        Events.after["cursor.rewind"],
      );
      throw e;
    }
  }

  async #triggerInit() {
    const invocationSymbol = Symbol("find.cursor.execute");
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
        Events.afterSuccess["find.cursor.execute"],
        Events.after["find.cursor.execute"],
        Events.afterSuccess["cursor.execute"],
        Events.after["find.cursor.execute"],
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
        Events.after["find.cursor.execute"],
        Events.afterError["cursor.execute"],
        Events.after["cursor.execute"],
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
      InternalEvents["cursor.next"]
    )
  }

  async toArray(): Promise<TSchema[]> {
    assertCaller(this.#caller, "find.cursor.toArray");
    return this.#tryCatchEmit(
      this.#ee,
      ({ invocationSymbol }) => this.#wrapCaller("find.cursor.toArray", async () => {
        if (this.#cursor.id === undefined) {
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
      InternalEvents["find.cursor.toArray"],
      InternalEvents["cursor.toArray"],
    );
  }

  async count(options?: CountOptions): Promise<number> {
    assertCaller(this.#caller, "find.cursor.count");
    return this.#tryCatchEmit(
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
      "find.cursor.count"
    );
  }

  async forEach(iterator: (doc: TSchema) => boolean | void): Promise<void> {
    assertCaller(this.#caller, "find.cursor.forEach");
    return this.#tryCatchEmit(
      this.#ee,
      ({ beforeHooksResult: [chainedIterator], invocationSymbol }) => this.#wrapCaller("find.cursor.forEach", async () => {
        if (this.#cursor.id === undefined) {
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
      "find.cursor.forEach",
      "cursor.forEach"
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
        thisArg: this
      },
      this.#invocationOptions,
      "before.find.cursor.asyncIterator",
      "before.cursor.asyncIterator"
    );
    try {

      if (this.#cursor.id === undefined) {
        await this.#wrapCaller("find.cursor.asyncIterator", () => this.#triggerInit(), invocationSymbol);
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
          caller: "find",
          invocationSymbol,
          parentInvocationSymbol: this.#findInvocationSymbol,
          thisArg: this,
          error: e
        },
        this.#invocationOptions,
        "after.find.cursor.asyncIterator.error",
        "after.find.cursor.asyncIterator",
        "after.cursor.asyncIterator.error",
        "after.cursor.asyncIterator"
      );
      throw e;
    }
    finally {
      if (errored || !started) {
        return;
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
        "after.find.cursor.asyncIterator",
        "after.cursor.asyncIterator.success",
        "after.cursor.asyncIterator"
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
      interceptExecute: this.#interceptExecute,
      invocationOptions: this.#invocationOptions
    });
  }
}
