import {
  HookedCollection,
  ExtendableHookedFindCursor,
  HookedFindCursorOptions,
  ExternalBeforeAfterEvent,
  MaybeStrictFilter,
  AmendedFindOptions,
  StandardInvokeHookOptions,
  StandardInvokeHookOptionsFromCollection
} from "mongo-collection-hooks";
import { Collection, Document, FindCursor, MongoClient } from "mongodb";

// --- Custom Collection Event Definitions ---

type MyCollectionExtraEventsDefinition = {
  "customMethod": ExternalBeforeAfterEvent<{
    args: [string];
    result: number;
    thisArg: ExtendedHookedCollection;
    forCollection: true;
  }>;
};

// --- Custom Cursor Event Definitions ---

type MyCursorExtraEventsDefinition = {
  "customCursorMethod": ExternalBeforeAfterEvent<{
    args: [number];
    result: boolean;
    forCursor: true;
    forCollection: false;
    thisArg: ExtendedHookedFindCursor;
  }>;
};

// --- Extended Hooked Collection ---

export class ExtendedHookedCollection<
  TSchema extends Document = Document
> extends HookedCollection<TSchema, MyCollectionExtraEventsDefinition & MyCursorExtraEventsDefinition> {
  constructor(collection: Collection<TSchema>) {
    // Pass HookedFindCursor constructor that knows about custom cursor events
    super(collection, { findCursorImpl: ExtendedHookedFindCursor });
  }

  // Override find to return the correct cursor type
  find<T extends Document = TSchema>(filter: MaybeStrictFilter<TSchema> = {}, options?: AmendedFindOptions<TSchema>): ExtendedHookedFindCursor<T, TSchema> {
    return super.find(filter, options) as ExtendedHookedFindCursor<T, TSchema>;
  }


  async customMethod(arg: string, options?: StandardInvokeHookOptionsFromCollection<ExtendedHookedCollection<TSchema>>): Promise<number> {
    // Use the protected _tryCatchEmit method
    return this._tryCatchEmit(
      "customMethod",  // The base name of the event
      { args: [arg] }, // Arguments for the 'before' hook and the operation
      "args", // Key in emitArgs to chain from 'before' to the operation
      async ({ beforeHooksResult: [chainedArg] }) => {
        // This is the core logic of the custom method
        console.log("Running customMethod with arg:", chainedArg);
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 50));
        // Return the result expected by the 'after.success' hook
        return chainedArg.length;
      },
      options
    );
  }
}

// --- Extended Hooked Find Cursor ---



export class ExtendedHookedFindCursor<
  TSchema = any,
  CollectionSchema extends Document = Document
> extends ExtendableHookedFindCursor<TSchema, CollectionSchema, MyCursorExtraEventsDefinition> {

  // Constructor needs to accept the same arguments as HookedFindCursor
  constructor(
    filter: MaybeStrictFilter<CollectionSchema> | undefined,
    findCursor: FindCursor<TSchema>,
    options: HookedFindCursorOptions<TSchema> // Use the base options type
  ) {
    super(filter, findCursor, options); // Pass options to the base constructor
  }

  async customCursorMethod(arg: number): Promise<boolean> {
    // Use the protected _tryCatchEmit method from HookedFindCursor
    // Note: We pass 'true' for chainResults as the after hook returns the result
    return this._tryCatchEmit(
      "customCursorMethod", // Base event name
      { args: [arg] }, // Arguments
      "args", // Key to chain from 'before' hook
      true, // Chain the result from the 'after.success' hook
      async ({ beforeHooksResult: [chainedArg] }) => {
        // Core logic for the custom cursor method
        console.log("Running customCursorMethod with arg:", chainedArg);
        await new Promise(resolve => setTimeout(resolve, 20));
        return chainedArg > 10; // Return the boolean result
      },
      undefined // Optional invocation options
    );
  }

  // Override clone to return the correct type
  clone(): ExtendedHookedFindCursor<TSchema, CollectionSchema> {
    return super.clone() as ExtendedHookedFindCursor<TSchema, CollectionSchema>;
  }

   // Override map to return the correct type
   map<T>(transform: (doc: TSchema) => T): ExtendedHookedFindCursor<T, CollectionSchema> {
    return super.map(transform) as ExtendedHookedFindCursor<T, CollectionSchema>;
  }
}


const client = new MongoClient(process.env.MONGO_URL || "");

const collection = new ExtendedHookedCollection(client.db().collection("dummy"));

collection.on("before.customCursorMethod", ({
  args,
  argsOrig,
  hookOptions,
  invocationSymbol,
  signal,
  thisArg
}) => {

});

collection.on("before.customMethod", ({
  args,
  argsOrig,
  hookOptions,
  invocationSymbol,
  signal,
  thisArg
}) => {

})
