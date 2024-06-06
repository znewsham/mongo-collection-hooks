export { HookedFindCursor } from "./hookedFindCursor2.js";

// import { FindCursor } from "mongodb";
// import type { AbstractCursorOptions, MongoClient, Document, CountOptions, EstimatedDocumentCountOptions } from "mongodb";
// import { AfterEventNames, BeforeAfterEventDefinitions, BeforeEventNames, CallerType, Events, HookedEventEmitter, InternalEvents, internalSymbolToBeforeAfterKey } from "./events.js";
// import { MongoDBCollectionNamespace } from "mongodb/lib/utils.js";

// interface HookedFindCursorOptions<TSchema extends Document, U extends any> extends AbstractCursorOptions {
//   transform?(doc: TSchema): U
//   events: Record<string, []>,
//   invocationSymbol: symbol,
// }

// export class HookedFindCursor<TSchema extends Document, U extends any = any> extends FindCursor<TSchema> {
//   #transform?:(doc: TSchema) => U;
//   #ee = new HookedEventEmitter<TSchema, U>();
//   #findInvocationSymbol: symbol;
//   #currentInvocationSymbol: symbol;
//   #filter: Document;
//   #caller: CallerType = "find";

//   constructor(client: MongoClient, namespace: MongoDBCollectionNamespace, filter: Document, {
//     transform,
//     events,
//     invocationSymbol,
//     ...options
//   }: HookedFindCursorOptions<TSchema, U>) {
//     // @ts-expect-error
//     super(client, namespace, filter, options);
//     this.#filter = filter;
//     this.#transform = transform;
//     this.#findInvocationSymbol = invocationSymbol;
//     this.#currentInvocationSymbol = invocationSymbol;
//     Object.entries(events).forEach(([name, listeners]) => {
//       listeners.forEach(listener => this.#ee.addListener(name, listener));
//     });
//   }

//   filter(filter: Document) {
//     super.filter(filter);
//     this.#filter = filter;
//     return this;
//   }

//   addFilter(filter: Document) {
//     return this.filter({
//       $and: [this.#filter, filter]
//     });
//   }

//   _initialize(session: any, callback: (state: any, error: any) => {}) {
//     const invocationSymbol = Symbol();
//     this.#ee.callAllAwaitableInParallel(
//       {
//         caller: "find",
//         parentInvocationSymbol: this.#findInvocationSymbol,
//         thisArg: this,
//         invocationSymbol
//       },
//       Events.before["cursor.execute"],
//       Events.before["find.cursor.execute"]
//     )
//     .then(() => {
//       // @ts-expect-error
//       super._initialize(session, async (error, state) => {
//         await this.#ee.callAllAwaitableInParallel(
//           {
//             caller: "find",
//             parentInvocationSymbol: this.#findInvocationSymbol,
//             thisArg: this,
//             invocationSymbol,
//             error
//           },
//           Events.after["cursor.execute"],
//           Events.after["find.cursor.execute"]
//         );
//         callback(error, state);
//       });
//     });
//   }

//   // @ts-expect-error
//   async next(): Promise<U | TSchema | null> {
//     return this.#tryCatchEmit(
//       async () => {
//         let next: TSchema | U | null = await super.next();

//         if (this.#transform && next) {
//           next = this.#transform(next);
//         }
//         return next;
//       },
//       undefined as never,
//       false,
//       true,
//       InternalEvents["find.cursor.next"],
//       InternalEvents["cursor.next"]
//     )
//   }

//   async #wrapCaller<T>(caller: CallerType, fn: () => Promise<T>, invocationSymbol?: symbol): Promise<T> {
//     try {
//       this.#caller = caller;
//       if (invocationSymbol) {
//         this.#currentInvocationSymbol = invocationSymbol;
//       }
//       return fn();
//     }
//     finally {
//       this.#caller = "find";
//       this.#currentInvocationSymbol = this.#findInvocationSymbol;
//     }
//   }

//   async #tryCatchEmit<
//     T extends (callArgs: { beforeHooksResult: BeforeAfterEventDefinitions<TSchema, U>[IE]["before"]["returns"] }) => Promise<any>,
//     IE extends keyof BeforeAfterEventDefinitions<TSchema, U> & ("find.cursor.count" | "find.cursor.toArray" | "find.cursor.next" | "find.cursor.forEach" | "find.cursor.asyncIterator")
//   >(
//     fn: T,
//     args: BeforeAfterEventDefinitions<TSchema, U>[IE]["before"]["args"],
//     chainArgs: boolean = false,
//     chainResult: boolean = false,
//     internalEvent: IE,
//     ...additionalInternalEvents: (keyof BeforeAfterEventDefinitions<TSchema, U>)[]
//   ): Promise<Awaited<ReturnType<T>>> {
//     const invocationSymbol = Symbol();

//     const argsOrig = args;

//     let chainedArgs = args;

//     const {
//       before: beforeEvent,
//       after: afterEvent
//     }: { before: BeforeEventNames, after: AfterEventNames } = internalSymbolToBeforeAfterKey(internalEvent);

//     const additionalBeforeEvents = additionalInternalEvents.map(additionalInternalEvent => internalSymbolToBeforeAfterKey(additionalInternalEvent).before);
//     const additionalAfterEvents = additionalInternalEvents.map(additionalInternalEvent => internalSymbolToBeforeAfterKey(additionalInternalEvent).after);

//     if (chainArgs) {
//       chainedArgs = await this.#ee.callAllAwaitableChainWithKey(
//         {
//           invocationSymbol,
//           parentInvocationSymbol: this.#currentInvocationSymbol,
//           thisArg: this,
//           // @ts-expect-error
//           ...(args & { args }),
//           // @ts-expect-error
//           ...(argsOrig & { argsOrig }),
//           caller: this.#caller,
//         },
//         "args",
//         beforeEvent,
//         ...additionalBeforeEvents
//       );
//     }
//     else {
//       await this.#ee.callAllAwaitableInParallel(
//         {
//           invocationSymbol,
//           // @ts-expect-error
//           ...(args & { args }),
//           parentInvocationSymbol: this.#currentInvocationSymbol,
//           thisArg: this,
//           caller: this.#caller
//         },
//         beforeEvent,
//         ...additionalBeforeEvents
//       );
//     }
//     let gotResult = false;
//     try {
//       let result = await fn({ beforeHooksResult: chainedArgs });
//       gotResult = true;
//       if (chainResult) {
//         const chainedResult = await this.#ee.callAllAwaitableChainWithKey(
//           {
//             invocationSymbol,
//             parentInvocationSymbol: this.#currentInvocationSymbol,
//             thisArg: this,
//             // @ts-expect-error
//             ...(args & { args }),
//             // @ts-expect-error
//             ...(argsOrig & { argsOrig }),
//             caller: this.#caller,
//             result
//           },
//           "result",
//           afterEvent,
//           ...additionalAfterEvents
//         );
//         if (chainedResult !== undefined) {
//           result = chainedResult;
//         }
//       }
//       else {
//         await this.#ee.callAllAwaitableInParallel(
//           {
//             invocationSymbol,
//             parentInvocationSymbol: this.#currentInvocationSymbol,
//             thisArg: this,
//             // @ts-expect-error
//             ...(args & { args }),
//             // @ts-expect-error
//             ...(argsOrig & { argsOrig }),
//             caller: this.#caller,
//             result
//           },
//           afterEvent,
//           ...additionalAfterEvents
//         );
//       }
//       return result;
//     }
//     catch (e) {
//       if (!gotResult) {
//         await this.#ee.callAllAwaitableInParallel(
//           {
//             invocationSymbol,
//             parentInvocationSymbol: this.#findInvocationSymbol,
//             thisArg: this,
//             // @ts-expect-error
//             ...(args & { args }),
//             // @ts-expect-error
//             ...(argsOrig & { argsOrig }),
//             caller: this.#caller,
//             error: e
//           },
//           afterEvent,
//           ...additionalAfterEvents
//         );
//       }
//       throw e;
//     }
//   }

//   // @ts-expect-error
//   async toArray(): Promise<TSchema[] | U[]> {
//     return this.#tryCatchEmit(
//       () => this.#wrapCaller("find.cursor.toArray", () => super.toArray()),
//       undefined as never,
//       false,
//       true,
//       InternalEvents["find.cursor.toArray"],
//       InternalEvents["cursor.toArray"],
//     );
//   }

//   async count(options?: CountOptions): Promise<number> {
//     return this.#tryCatchEmit(
//       ({ beforeHooksResult: optionsToUse }) => this.#wrapCaller("find.cursor.count", () => super.count(...optionsToUse)),
//       [options],
//       false,
//       true,
//       InternalEvents["find.cursor.count"],
//       InternalEvents["cursor.count"],
//     );
//   }

//   async forEach(iterator: (doc: TSchema) => boolean | void): Promise<void> {
//     return this.#tryCatchEmit(
//       ({ beforeHooksResult: [chainedIterator] }) => this.#wrapCaller("find.cursor.forEach", () => super.forEach(chainedIterator)),
//       [iterator],
//       true,
//       false,
//       "find.cursor.forEach",
//       "cursor.forEach"
//     );
//   }

//   async *[Symbol.asyncIterator](): AsyncGenerator<TSchema, void, void> {
//     const invocationSymbol = Symbol();
//     await this.#ee.callAllAwaitableInParallel(
//       {
//         caller: "find",
//         invocationSymbol,
//         parentInvocationSymbol: this.#findInvocationSymbol,
//         thisArg: this
//       },
//       "before.find.cursor.asyncIterator",
//       "before.cursor.asyncIterator"
//     );
//     try {
//       const iterator = super[Symbol.asyncIterator]();
//       for await (const item of iterator) {
//         yield item;
//       }
//       await this.#ee.callAllAwaitableInParallel(
//         {
//           caller: "find",
//           invocationSymbol,
//           parentInvocationSymbol: this.#findInvocationSymbol,
//           thisArg: this,
//         },
//         "after.find.cursor.asyncIterator",
//         "after.cursor.asyncIterator"
//       );
//     }
//     catch (e) {
//       await this.#ee.callAllAwaitableInParallel(
//         {
//           caller: "find",
//           invocationSymbol,
//           parentInvocationSymbol: this.#findInvocationSymbol,
//           thisArg: this,
//           error: e
//         },
//         "after.find.cursor.asyncIterator",
//         "after.cursor.asyncIterator"
//       );
//     }
//   }
// }
