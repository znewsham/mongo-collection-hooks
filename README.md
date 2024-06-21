# Mongo Collection Hooks
This package implements collection hooks, similar to [Meteor Collection Hooks](https://github.com/Meteor-Community-Packages/meteor-collection-hooks) but without the meteor dependencies (or any other in fact).

The `HookedCollection` class takes as an argument a collection implementing the mongodb `Collection` interface - or whatever portion of it you intend to use. For example, if you only plan to use `insertOne` - you need only provide something that implements that portion of the interface. The typical argument here would be an actual mongo collection, on the server. However this would happily work client side with whatever implementation you provide.

## Basic Usage

```typescript

import { HookedCollection } from "mongo-collection-hooks";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGO_URL);

const collection = new HookedCollection(client.db().collection("MyCollection"));


collection.on("before.update", () => {
  // do something
});
```

## Hook types
There are approximately 180 distinct hooks which can be used in different combinations.

In general, there is one set of hooks per top level function of a collection in the set of:
- `insertOne` and `insertMany`
- `updateOne`, `updateMany` and `replaceOne`
- `deleteOne` and `deleteMany`
- `findOne`, `findOneAndUpdate`, `findOneAndReplace` and `findOneAndDelete`
- `find` and `aggregate` (synchronous hooks)
- `distinct`
- `count`, `countDocuments` and `estimatedDocumentCount`.

There are also hooks which are registered against a collection, but will be triggered by cursor actions, e.g., `aggregate` or `find`. These can be specified per cursor type (e.g., `before.aggregation.cursor.forEach`) or general (e.g., `before.cursor.forEach`)
- `forEach`
- `toArray`
- `asyncIterator`
- `next`
- `close`
- `rewind` (sync)
- `execute` (see notes below)
- `count` (find only)

Lastly, There are some additional hooks implemented to assist with certain types of requirements (e.g., metrics):
- `*` - triggered for every operation (including cursor events)
- `count*` - triggered for all count operations
- `findOne*` - triggered for `findOne` and `findOneAnd<Replace | Update | Delete>` operations
- `insert`, `update`, `delete` - triggered once per document from the relevant operations that can insert, update or delete. These are particularly interesting, expensive and complicated hooks and are documented further below.

All the options above (including `*` and cursor generic hooks) provide 4 hooks.
- `before`
- `after` (triggered in the case of either success or error)
- `after.success`
- `after.error`


All hooks are triggered with a single argument of this general form - the *exact* structure is documented per hook. In general there is a lot of overlap between the `before` and `after*` variants of a hook

```typescript
type StandardBeforeHookCallArg = {
  thisArg: HookedCursor | HookedCollection,
  invocationSymbol: symbol, // a unique per-invocation symbol, the same will be provided to `before` and `after*` hooks
  args: unknown[] | never, // the arguments of the function - possibly different from the original arguments as they could be modified by previous hooks
  origArgs: unknown[] | never, // the origianl arguments of the function, exactly as passed in
  // these are provided for nested hooks, e.g., "update" could have a caller of "updateOne"
  caller?: string,
  parentInvocationSymbol?: symbol,
}

type StandardAfterSuccessHookCallArg = StandardBeforeHookCallArg & {
  result?: unknown, // the result of the function, possibly modified by previous hooks
  resultOrig: unknown, // the original result of the function, exactly as returned
}

type StandardAfterErrorHookCallArg = StandardBeforeHookCallArg & {
  error?: any, // the error thrown by the function
}

type StandardAfterHookCallArg = StandardBeforeHookCallArg & {
  result?: unknown
  resultOrig?: unknown
  error?: any
}

type StandardDefineHookOptions = {
  tags?: string[] // used in combination with the {includeTags | excludeTags} from StandardInvokeHookOptions
}

type StandardInvokeHookOptions = {
  includeTags?: string[],
  excludeTags?: string[],
  includeHook(hookName: string, hook: Hook, options: Options): boolean
}
```

## A note about hook order
The exact order in which the hooks for a single event will run are illustrative, but shouldn't be relied on entirely until this hits v1.0 - until then they'll change as seems appropriate. The only thing that can be guaranteed is the `before` hooks will all complete before the functionality they hook, and the `after` hooks will all start after the functionality they hook has completed.

## Properties
An explanation of each of the properties of the argument you might find in a standard hook

### args
The `args` property will be the same type as the call args for the function the hook is for - for functions that take no arguments (e.g., toArray()) there will be no `args` property. Most `before.*` hooks are allowed to return a transformation of the `args` object - which will be provided to subsequent hooks as well as ultimately used by the function implementation.

### argsOrig
Like `args`, the `argsOrig` property is the same type as the call args - and will always be the exact same values as passed in - regardless of the return of previous `before` hooks.

### invocationSymbol
The `invocationSymbol` property provides a way of associating pairs of before and after executions - regardless of the number of `{before|after}.findOne` hooks applied - they will *ALL* receive the same `invocationSymbol` for a single call to `findOne`.

### thisArg
The `thisArg` property is a reference to whichever collection or cursor triggered the hook.

### result (after only)
The `result` property will be the same type as the return type of the function being hooked - e.g., for `updateOne` the `after.updateOne` hook will accept a `result: UpdateResult` property. Must `after` hooks are allowed to return a transformation of this result, while still adhering to the type, which will be passed to subsequent after hooks and returned. For functions that don't return a result, e.g., `forEach()` - there will be no `result` property.

### resultOrig (after only)
Like `result`, the `resultOrig` property is the same type as the return type of the function being hooked. And like `argsOrig` - this property will always represent the original value returned, regardless of previous `after*` hooks.

### error (after only)
In the case of an error, it will be provided to the `after.error` and `after` hooks. In general these do *NOT* chain - and they cannot return a transformation of the error.

### parentInvocationSymbol
In cases where multiple hooks are triggered (e.g., a single `updateMany` call may trigger multiple `update` hooks, one per document) it is useful to know the underlying invocation which triggered these "child" hooks. This is the `invocationSymbol` of that "parent" call - and thus will be the same for all "child" hooks.

### caller (TBC)
In the case where a hook isn't directly related to a function (e.g., `after.update`), or could be triggered from multiple places (e.g, `before.cursor.toArray`) the `caller` property identifies where the call came from - it typicailly appears with the `parentInvocationSymbol`.

## Hooks
Some hooks are pretty simple and will be lightly documented with a trivial example and the type of arguments they accept. There are a handful, those listed above that are more interesting and will be documented to a higher level.

### update
The `update` hook is one of the most interesting, complicated, expensive and powerful hooks. It will fire once for each document updated - whether through `update*`, `replaceOne` or `findOneAnd{Update | Replace}`. The `before` hook have efficient access to the current document (tuned via a projection option on the hook). The `after*` hooks have efficient access to both the previous and modified document if the hook is configured to do so. The use of the `update` hook allows transforming the modifier on a per-document basis.

The `getDocument` hook ensures the DB is called at most once per document - regardless of how many hooks require the document. Hooks can also be configured to greedily load these items, ensuring no additional DB operations (at the cost of a heavier initial query).

In the case of `updateMany` if no `before.insert` or `after.insert` are to be used, the underlying implementation's `updateMany` will be used. However, if hooks are defined `updateOne` will be used instead. In all other cases the correct underlying implementation will be used. In all cases, the filter returned by before hooks will be combined with any `{ _id }` query - correctly targetting a single document.

This hook allows several options at registration time:
| Option | Limitation | Description |
|---|---|---|
| `projection` | | The union of projects will be used to fetch the document when `getDocument()` is called. |
| `shouldRun` | | As the mere presence of these hooks can be very expensive (e.g., additional cursor at minimum) this function can be used to tune which hooks should be ran. Allowing you to filter |
| `fetchPrevious` | After | whether the previous document should be fetched. If any after hook uses this field, the relevant document will be pulled from the DB before the update. |
| `fetchPreviousProjection` | After | As with `projection`, also the union of all defined, used to control which fields of the document are available on `previousDocument`. |


```typescript

type FilterMutator = {
  filter: Filter,
  mutator?: UpdateFilter | Partial,
  replacement: Document
}
type Before = {
  callArg: StandardBeforeHookCallArg & {
    caller: "updateOne" | "updateMany" | "replaceOne" | "findOneAndReplace" | "findOneAndUpdate"
    args: UpdateCallArgs | ReplaceCallArgs | FindOneAndUpdateCallArgs | FindOneAndReplaceCallArgs,
    argsOrig: <same as args>,
    _id: string,
    getDocument: () => Promise<Document | null>
    filterMutator: FilterMutator
    filterMutatorOrig: FilterMutator
  },
  returns: FilterMutator | void | Promise<FilterMutator | void>
}

type After = {
  callArg: Before["callArg"] & {
    previousDocument?: Document,
    // the result is tied to the caller - checking the caller will infer the result type.
    result: UpdateResult | ModifyResult<TSchema> | Document
    resultOrig: <same as result>
  },
  returns: UpdateResult | ModifyResult<TSchema> | Document | void | Promise<UpdateResult | ModifyResult<TSchema> | Document | void>
}

type BeforeOptions = StandardDefineHookOptions & {
  projection?: Document | (({ argsOrig, thisArg } : Before["callArg"]["argsOrig"], thisArg: HookedCollection }): Document
  shouldRun?: ({ argsOrig, thisArg }): { argsOrig: Before["callArg"]["argsOrig"], thisArg: HookedCollection }): boolean | Promise<boolean>
}

type AfterOptions = BeforeOptions & {
  fetchPrevious?: boolean
  fetchPreviousProjection?: Document | (({ argsOrig, thisArg } : Before["callArg"]["argsOrig"], thisArg: HookedCollection }): Document
}
```


### delete
The `delete` hook is similar to the `update` hook - in particular, the `before.delete` hook receives almost identical parameters to the `before.update` hook - e.g., it can access the entire document if necessary.

This hook allows several options at registration time:
| Option | Limitation | Description |
|---|---|---|
| `projection` | | The union of projects will be used to fetch the document when `getDocument()` is called. |
| `shouldRun` | | As the mere presence of these hooks can be very expensive (e.g., additional cursor at minimum) this function can be used to tune which hooks should be ran. Allowing you to filter |
| `fetchPrevious` | After | whether the previous document should be fetched. If any after hook uses this field, the relevant document will be pulled from the DB before the deletion. |
| `fetchPreviousProjection` | After | As with `projection`, also the union of all defined, used to control which fields of the document are available on `previousDocument`. |

```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    caller: "deleteOne" | "deleteMany" | "findOneAndDelete"
    args: DeleteCallArgs | FindOneAndDeleteCallArgs,
    argsOrig: <same as args>,
    _id: string,
    getDocument: () => Promise<Document | null>
    filter: Filter
    filterOrig: Filter
  },
  returns: Filter | void | Promise<Filter | void>
}

type After = {
  callArg: Before["callArg"] & {
    // the result is tied to the caller - checking the caller will infer the result type.
    result: DeleteResult | ModifyResult<TSchema> | Document
    resultOrig: <same as result>
  },
  returns: DeleteResult | ModifyResult<TSchema> | Document | void | Promise<DeleteResult | ModifyResult<TSchema> | Document | void>
}

type BeforeOptions = StandardDefineHookOptions & {
  projection?: Document | (({ argsOrig, thisArg } : Before["callArg"]["argsOrig"], thisArg: HookedCollection }): Document
  shouldRun?: ({ argsOrig, thisArg }): { argsOrig: Before["callArg"]["argsOrig"], thisArg: HookedCollection }): boolean | Promise<boolean>
}

type AfterOptions = BeforeOptions & {
  fetchPrevious?: boolean
  fetchPreviousProjection?: boolean
}
```

### insert
The `insert` event is fired once for every document inserted into the database, this obviously includes `insertOne` and `insertMany` - but less obviously can also include any of the update functions too, e.g., `updateOne` and `findOneAndReplace`. If calls to those functions include `upsert: true` in the options and no matching document is found, the `insert` hooks will fire. The underlying implementation however does not change. A call to `findOneAndReplace` will always call `findOneAndReplace` of the underlying implementation. As such, it is possible for you to receive a `before.insert` hook for an update, with an `after.insert.succes` hook indicating that a document was updated and NOT inserted.

The `before` hook chains the `doc` property - returning a new document here will change what is inserted.

This hook also supports returning the `SkipDocument` symbol to indicate this document should not be inserted.

```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    caller: "insertOne" | "insertMany" | "updateOne" | "updateMany" | "replaceOne" | "findOneAndReplace" | "findOneAndUpdate"
    args: InsertOneCallArgs | InsertManyCallArgs | UpdateCallArgs | ReplaceOneCallArgs | FindOneAndUpdateCallArgs | FindOneAndReplaceCallArgs
    argsOrig: <same as args>,
    doc: Document
  },
  returns: Document | void | Promise<Document | void> | SkipDocument
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: InsertOneResult
    resultOrig: InsertOneResult
  },
  returns: InsertOneResult | void | Promise<InsertOneResult | void>
}

type Options = StandardDefineHookOptions

collection.on("before.insert", ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg,
  doc
}) => doc);
```

### findOne
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Filter, FindOptions & StandardInvokeHookOptions],
    argsOrig: <same as args>
  },
  returns: FindArgs | void | Promise<FindArgs | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: Document | null,
    resultOrig: Document | null
  },
  returns: Document | null | void | Promise<Document | null | void>
}

type Options = StandardDefineHookOptions


collection.on("before.findOne", async ({
  args,
  argsOrig,
  invocationSymbol,
  thisArg
}) => {
  return mutatedCopyOfArgs;
})
```
#### Invocation order [See note](#a-note-about-hook-order)
When invoking `findOne` the following hooks (if defined) will run in order.

- `before.*`
  - `before.findOne`
  - `before.findOne*`
  - (`after.findOne.success` or `after.findOne.error`) and `after.findOne`
  - (`after.findOne*.success` or `after.findOne*.error`) and `after.findOne*`
- (`after.*.success` or `after.*.error`) and `after.*`

### insertOne
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Document, InsertOptions],
    argsOrig: <same as args>,
    _id?: InferIdType
  },
  returns: [Document, InsertOptions] | void | Promise<[Document, InsertOptions] | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: InsertResult,
    resultOrig: InsertResult
  },
  returns: InsertResult | void | Promise<InsertResult | void>
}

type Options = StandardDefineHookOptions & { includeId?: boolean }
```

#### Invocation order [See note](#a-note-about-hook-order)
When invoking `insertOne` the following hooks (if defined) will run in order:


- `before.*`
  - `before.insertOne`
    - `before.insert`
    - (`after.insert.success` or `after.insert.error`) and `after.insert`
  - (`after.insertOne.success` or `after.insertOne.error`) and `after.insertOne`
- (`after.*.success` or `after.*.error`) and `after.*`

### insertMany
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Document[], InsertOptions],
    argsOrig: <same as args>,
    _ids?: InferIdType[]
  },
  returns: [Document[], InsertOptions] | void | Promise<[Document[], InsertOptions] | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: InsertResult,
    resultOrig: InsertResult
  },
  returns: InsertResult | void | Promise<InsertResult | void>
}

type Options = StandardDefineHookOptions & { includeIds?: boolean }
```

#### Invocation order [See note](#a-note-about-hook-order)
When invoking `insertMany` the following hooks (if defined) will run in order:


- `before.*`
  - `before.insertMany`
    - `before.insert` once per doc - in parallel
    - (`after.insert.success` or `after.insert.error`) and `after.insert` once per doc - in parallel
  - (`after.insertMany.success` or `after.insertMany.error`) and `after.insertMany`
- (`after.*.success` or `after.*.error`) and `after.*`

### deleteOne
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Filter, DeleteOptions],
    argsOrig: <same as args>,
    _id?: InferIdType
  },
  returns: [Filter, DeleteOptions] | void | Promise<[Filter, DeleteOptions] | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: DeleteResult,
    resultOrig: DeleteResult
  },
  returns: DeleteResult | void | Promise<DeleteResult | void>
}

type Options = StandardDefineHookOptions & { includeId?: boolean }
```

#### Invocation order [See note](#a-note-about-hook-order)
When invoking `deleteOne` the following hooks (if defined) will run in order:


- `before.*`
  - `before.deleteOne`
    - `before.delete`
    - (`after.delete.success` or `after.delete.error`) and `after.delete`
  - (`after.deleteOne.success` or `after.deleteOne.error`) and `after.deleteOne`
- (`after.*.success` or `after.*.error`) and `after.*`

### deleteMany
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Filter[], DeleteOptions],
    argsOrig: <same as args>,
    _ids?: InferIdType[]
  },
  returns: [Filter[], DeleteOptions] | void | Promise<[Filter[], DeleteOptions] | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: DeleteResult,
    resultOrig: DeleteResult
  },
  returns: DeleteResult | void | Promise<DeleteResult | void>
}

type Options = StandardDefineHookOptions & { includeId?: boolean }
```

#### Invocation order [See note](#a-note-about-hook-order)
When invoking `deleteMany` the following hooks (if defined) will run in order:


- `before.*`
  - `before.deleteMany`
    - `before.delete` once per doc - in parallel
    - (`after.delete.success` or `after.delete.error`) and `after.delete` once per doc - in parallel
  - (`after.deleteMany.success` or `after.deleteMany.error`) and `after.deleteMany`
- (`after.*.success` or `after.*.error`) and `after.*`

### updateOne
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Filter, Mutator, UpdateOptions],
    argsOrig: <same as args>
  },
  returns: [Filter, Mutator, UpdateOptions] | void | Promise<[Filter, Mutator, UpdateOptions] | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: UpdateResult,
    resultOrig: UpdateResult
  },
  returns: UpdateResult | void | Promise<UpdateResult | void>
}

type Options = StandardDefineHookOptions
```

#### Invocation order [See note](#a-note-about-hook-order)
When invoking `updateOne` the following hooks (if defined) will run in order:


- `before.*`
  - `before.updateOne`
    - either:
      - `before.update`
      - (`after.update.success` or `after.update.error`) and `after.update`
    - or (if upsert):
      - `before.insert`
      - (`after.insert.success` or `after.insert.error`) and `after.insert`
  - (`after.updateOne.success` or `after.updateOne.error`) and `after.updateOne`
- (`after.*.success` or `after.*.error`) and `after.*`

### updateMany
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Filter, Mutator, UpdateOptions],
    argsOrig: <same as args>
  },
  returns: [Filter, Mutator, UpdateOptions] | void | Promise<[Filter, Mutator, UpdateOptions] | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: UpdateResult,
    resultOrig: UpdateResult
  },
  returns: UpdateResult | void | Promise<UpdateResult | void>
}

type Options = StandardDefineHookOptions
```

#### Invocation order [See note](#a-note-about-hook-order)
When invoking `updateMany` the following hooks (if defined) will run in order:


- `before.*`
  - `before.updateMany`
    - once per doc, either:
      - `before.update`
      - (`after.update.success` or `after.update.error`) and `after.update`
    - or (if upsert):
      - `before.insert`
      - (`after.insert.success` or `after.insert.error`) and `after.insert`
  - (`after.updateMany.success` or `after.updateMany.error`) and `after.updateMany`
- (`after.*.success` or `after.*.error`) and `after.*`

### replaceOne
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Filter, Document, UpdateOptions],
    argsOrig: <same as args>
  },
  returns: [Filter, Document, UpdateOptions] | void | Promise<[Filter, Document, UpdateOptions] | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: UpdateResult,
    resultOrig: UpdateResult
  },
  returns: UpdateResult | void | Promise<UpdateResult | void>
}

type Options = StandardDefineHookOptions
```

#### Invocation order [See note](#a-note-about-hook-order)
When invoking `replaceOne` the following hooks (if defined) will run in order:

- `before.*`
  - `before.replaceOne`
    - either:
      - `before.update`
      - (`after.update.success` or `after.update.error`) and `after.update`
    - or (if upsert):
      - `before.insert`
      - (`after.insert.success` or `after.insert.error`) and `after.insert`
  - (`after.replaceOne.success` or `after.replaceOne.error`) and `after.replaceOne`
- (`after.*.success` or `after.*.error`) and `after.*`

### findOneAndUpdate
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Filter, Mutator, FindOneAndUpdateOptions],
    argsOrig: <same as args>
  },
  returns: [Filter, Mutator, FindOneAndUpdateOptions] | void | Promise<[Filter, Mutator, FindOneAndUpdateOptions] | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: ModifyResult | Document | null,
    resultOrig: ModifyResult | Document | null
  },
  returns: ModifyResult | Document | null | void | Promise<ModifyResult | Document | null | void>
}

type Options = StandardDefineHookOptions
```

#### Invocation order [See note](#a-note-about-hook-order)
When invoking `findOneAndUpdate` the following hooks (if defined) will run in order:

- `before.*`
  - `before.findOneAndUpdate` -> `before.findOne*`
    - either:
      - `before.update`
      - (`after.update.success` or `after.update.error`) and `after.update`
    - or (if upsert):
      - `before.insert`
      - (`after.insert.success` or `after.insert.error`) and `after.insert`
    - (`after.findOneAndUpdate.success` -> `after.findOne*.success` or `after.findOneAndUpdate.error` -> `after.findOne*.error`) and `after.findOneAndUpdate` -> `after.findOne*`
- (`after.*.success` or `after.*.error`) and `after.*`

### findOneAndReplace
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Filter, Document, FindOneAndReplaceOptions],
    argsOrig: <same as args>
  },
  returns: [Filter, Document, FindOneAndReplaceOptions] | void | Promise<[Filter, Document, FindOneAndUpdateOptions] | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: ModifyResult | Document | null,
    resultOrig: ModifyResult | Document | null
  },
  returns: ModifyResult | Document | null | void | Promise<ModifyResult | Document | null | void>
}

type Options = StandardDefineHookOptions
```

#### Invocation order [See note](#a-note-about-hook-order)
When invoking `findOneAndReplace` the following hooks (if defined) will run in order:

- `before.*`
  - `before.findOneAndReplace` -> `before.findOne*`
    - either:
      - `before.update`
      - (`after.update.success` or `after.update.error`) and `after.update`
    - or (if upsert):
      - `before.insert`
      - (`after.insert.success` or `after.insert.error`) and `after.insert`
  - (`after.findOneAndReplace.success` -> `after.findOne*.success` or `after.findOneAndReplace.error` -> `after.findOne*.error`) and `after.findOneAndReplace` -> `after.findOne*`
- (`after.*.success` or `after.*.error`) and `after.*`


### findOneAndDelete
```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [Filter, FindOneAndDeleteOptions],
    argsOrig: <same as args>
  },
  returns: [Filter, FindOneAndDeleteOptions] | void | Promise<[Filter, FindOneAndDeleteOptions] | void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: ModifyResult | Document | null,
    resultOrig: ModifyResult | Document | null
  },
  returns: ModifyResult | Document | null | void | Promise<ModifyResult | Document | null | void>
}

type Options = StandardDefineHookOptions
```

#### Invocation order [See note](#a-note-about-hook-order)
When invoking `findOneAndDelete` the following hooks (if defined) will run in order:

- `before.*`
  - `before.findOneAndDelete` -> `before.findOne*`
    - `before.delete`
    - (`after.delete.success` or `after.delete.error`) and `after.delete`
  - (`after.findOneAndDelete.success` -> `after.findOne*.success` or `after.findOneAndDelete.error` -> `after.findOne*.error`) and `after.findOneAndDelete` -> `after.findOne*`
- (`after.*.success` or `after.*.error`) and `after.*`

### Cursor hooks.
What follows are the cursor hooks - they are defined against a collection, and will apply to all relevant cursors created. `aggregation.cursor.*` hooks will apply to aggregation cursors `find.cursor.*` hooks will apply to find cursors, `cursor.*` hooks will apply to both. All these operations will have a `parentInvocationSymbol` which either identifies the `find` operation or, only in the case of `find.cursor.execute`, the cursor operation which triggered the execute.

### find.cursor.toArray

```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: never,
    argsOrig: never,
    // the find symbol
    parentInvocationSymbol: symbol,
  },
  returns: void | Promise<void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: Document[],
    resultOrig: Document[]
  },
  returns: Document[] | void | Promise<Document[] | void>
}

type Options = StandardDefineHookOptions
```

### find.cursor.count

```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: never,
    argsOrig: never,
    // the find symbol
    parentInvocationSymbol: symbol,
  },
  returns: void | Promise<void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: number,
    resultOrig: number
  },
  returns: number | void | Promise<number | void>
}

type Options = StandardDefineHookOptions
```

### find.cursor.next

```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: never,
    argsOrig: never,
    // the find symbol
    parentInvocationSymbol: symbol,
  },
  returns: void | Promise<void>
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: Document,
    resultOrig: Document,
  },
  returns: Document | void | Promise<Document | void>
}

type Options = StandardDefineHookOptions
```

### find.cursor.forEach

```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: [(iterator) => void],
    argsOrig: [(iterator) => void],
    // the find symbol
    parentInvocationSymbol: symbol,
  },
  returns: [(iterator) => void]
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: never,
    resultOrig: never
  },
  returns: void | Promise<void>
}

type Options = StandardDefineHookOptions
```

### find.cursor.execute
This is one of the interesting ones - tying into the actual cursor execution would require patching the internal function `_initialize` on a mongo cursor. In general, this is not necessary - it's sufficient to trigger the before and after events assuming the init *will* happen. If you truly want to know when a cursor executes, you can pass in the `interceptExecute: true` option.

```typescript
type Before = {
  callArg: StandardBeforeHookCallArg & {
    args: never,
    argsOrig: never,
    parentInvocationSymbol: symbol,
    caller: "find.cursor.next" | "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator"
  },
  returns: [(iterator) => void]
}

type AfterSuccess = {
  callArg: Before["callArg"] & {
    result: never,
    resultOrig: never
  },
  returns: void | Promise<void>
}

type Options = StandardDefineHookOptions
```

### TODO - all the others
They all have the same shape, 180 is a lot of copy/paste.
