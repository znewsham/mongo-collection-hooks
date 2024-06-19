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
  #caller: CallerType<"find.cursor.asyncIterator" | "find.cursor.forEach" | "find.cursor.toArray"  | "find.cursor.count" | "find.cursor.execute" | "find.cursor.next" | "find.cursor.close">;
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
            return this.#cursor.toArray();
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
            return this.#cursor.forEach(chainedIterator);
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
        yield item;
      }
    }
    catch (e) {
      errored = true;
      await this.#ee.callAllAwaitableInParallel(
        {
          invocationSymbol,
          parentInvocationSymbol: this.#findInvocationSymbol,
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
