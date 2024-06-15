import type { CountOptions } from "mongodb"
import { CursorParams, CursorParamsWithArgs, CursorParamsWithArgsAndResult, CursorParamsWithResult } from "./cursorHelperTypes.js"
import { HookedFindCursorInterface } from "./hookedFindCursorInterface.js"
import { BeforeAfterCallbackArgsAndReturn, ExtractEventDefinitions } from "./helpersTypes.js"
import { BeforeAfterErrorGenericCursorEventDefinitions } from "./genericCursorEvents.js"
import { BeforeAfterErrorSharedEventDefinitions } from "./sharedEvents.js"


export type BeforeAfterErrorFindOnlyCursorEventDefinitions<TSchema> = {
  "find.cursor.execute": CursorParams<HookedFindCursorInterface<TSchema>, {
    caller: "find.cursor.toArray" | "find.cursor.next" | "find.cursor.forEach" | "find.cursor.asyncIterator" | "find.cursor.count"
  }>,
  "find.cursor.next": CursorParamsWithResult<HookedFindCursorInterface<TSchema>, {
    caller: "find.cursor.toArray" | "find.cursor.forEach" | "find.cursor.asyncIterator",
    result: TSchema | null
  }>,
  "find.cursor.toArray": CursorParamsWithResult<HookedFindCursorInterface<TSchema>, {
    caller: "find",
    result: TSchema[]
  }>,
  "find.cursor.count": CursorParamsWithArgsAndResult<HookedFindCursorInterface<TSchema>, {
    caller: "find",
    result: number,
    args: [CountOptions | undefined]
  }>,
  "find.cursor.forEach": CursorParamsWithArgs<HookedFindCursorInterface<TSchema>, {
    caller: "find",
    result: never,
    args: [iterator: (doc: TSchema) => boolean | void]
  }>,
  "find.cursor.asyncIterator": CursorParams<HookedFindCursorInterface<TSchema>, {
    caller: "find"
  }>,
  "find.cursor.rewind": CursorParams<HookedFindCursorInterface<TSchema>, {
    caller: "find",
    isPromise: false
  }>,
  "find.cursor.close": CursorParams<HookedFindCursorInterface<TSchema>, {
    caller: "find"
  }>
}

export type BeforeAfterErrorFindCursorEventDefinitions<TSchema> = BeforeAfterErrorFindOnlyCursorEventDefinitions<TSchema>
  & BeforeAfterErrorGenericCursorEventDefinitions<TSchema>
  & BeforeAfterErrorSharedEventDefinitions<Document>;


type FindCursorBeforeEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorFindCursorEventDefinitions<TSchema>, "before", "before">
type FindCursorAfterSuccessEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorFindCursorEventDefinitions<TSchema>, "after", "success", "success">
type FindCursorAfterErrorEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorFindCursorEventDefinitions<TSchema>, "after", "error", "error">
type FindCursorAfterEventDefinitions<TSchema> = ExtractEventDefinitions<BeforeAfterErrorFindCursorEventDefinitions<TSchema>, "after", "after">

export type BeforeAfterErrorFindCursorFlatEventDefinitions<TSchema> = FindCursorBeforeEventDefinitions<TSchema>
  & FindCursorAfterSuccessEventDefinitions<TSchema>
  & FindCursorAfterErrorEventDefinitions<TSchema>
  & FindCursorAfterEventDefinitions<TSchema>;


type FindCursorCallbackArgsAndReturn<TSchema> = BeforeAfterCallbackArgsAndReturn<BeforeAfterErrorFindCursorFlatEventDefinitions<TSchema>>

export type FindCursorHookedEventMap<TSchema> = FindCursorCallbackArgsAndReturn<TSchema>;
