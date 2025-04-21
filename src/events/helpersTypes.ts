import { StandardDefineHookOptions } from "../awaiatableEventEmitter.js";
import { Abortable, Args, ArgsOrig, Caller, ErrorT, InvocationSymbol, ParentInvocationSymbol, Result, ResultOrError, ThisArg } from "./commentedTypes.js";


export type ReturnsNamedEmitArg<O extends {emitArgs: {[k in Key]: any}, isPromise?: boolean, beforeHookReturns?: any}, Key extends string> = O & {
  returns: O extends { beforeHookReturns: any } ? O["beforeHookReturns"] : O["emitArgs"][Key],
  returnEmitName: Key,
  isPromise: O["isPromise"] extends false ? false : true
}

export type ReturnsArgs<O extends {args: any, isPromise?: boolean}> = O & {
  returns: O["args"],
  returnEmitName: "args",
  isPromise: O["isPromise"] extends false ? false : true
}
export type ReturnsResult<O extends {result: any, isPromise?: boolean}> = {
  returns: O["result"],
  returnEmitName: "result",
  isPromise: O["isPromise"] extends false ? false : true
}
export type NoReturns<O extends { isPromise?: boolean } = {}> = {
  returnEmitName: never,
  isPromise: O["isPromise"] extends false ? false : true
}

export type Merge<A extends Record<string, any>, B extends Record<string, any>> = A & Omit<B, keyof A>

export type KeysMatching<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];


export type ItemMapEntry = {
  emitArgs: any,
  isPromise: boolean
  options?: any,
  returnEmitName: string | never
}

export type BeforeAfterCallbackArgsAndReturn<
  BIM extends Record<string, ItemMapEntry>,
  BIMNames extends keyof BIM & string = keyof BIM & string
> = {
  [k in BIMNames]: {
    callbackArgs:
    {
      /** The original "thing", e.g. arguments, result, doc, or whatever before any hook was applied */
      [rek in BIM[k]["returnEmitName"] as `${rek}Orig`]: BIM[k] extends { returns: any } ? BIM[k]["emitArgs"][BIM[k]["returnEmitName"]] : never
    } & BIM[k]["emitArgs"] & { hookOptions: BIM[k] extends { options: StandardDefineHookOptions } ? BIM[k]["options"] : StandardDefineHookOptions },
    emitArgs: BIM[k]["emitArgs"],
    returns: BIM[k] extends { returns: any } ? BIM[k]["returns"] : never,
    options: BIM[k] extends { options: StandardDefineHookOptions } ? BIM[k]["options"] : StandardDefineHookOptions,
    caller: BIM[k] extends { caller: any } ? BIM[k]["caller"] : undefined,

    // these two fields need this bizare structure - for some reason even though what is passed in *ALWAYS* has an isPromise value,
    // without these lines, generic usage of this helper type doesn't map to ChainedCallbackEventMapWithCaller
    isPromise: BIM[k]["isPromise"] extends boolean ? BIM[k]["isPromise"] : true,
    returnEmitName: BIM[k] extends { returnEmitName: never } ? never : BIM[k] extends { returnEmitName: string } ? BIM[k]["returnEmitName"] : string,

  }
}

export const SkipDocument = Symbol("SkipDocument");

export type ExtractStandardBeforeAfterEventDefinitions<
  EventMap extends Record<string, { before: InternalEventDefinition, success: InternalEventDefinition, error: InternalEventDefinition, after: InternalEventDefinition }>
> = ExtractEventDefinitions<EventMap, "before", "before", 0>
  & ExtractEventDefinitions<EventMap, "after", "success", "success">
  & ExtractEventDefinitions<EventMap, "after", "error", "error">
  & ExtractEventDefinitions<EventMap, "after", "after", 0>

export type ExtractEventDefinitions<
  EventMap extends Record<string, { before: InternalEventDefinition, success: InternalEventDefinition, error: InternalEventDefinition, after: InternalEventDefinition }>,
  Prefix extends "before" | "after",
  Accessor extends "before" | "success" | "error" | "after",
  Suffix extends string | number = number,
  // K extends keyof EventMap & string = keyof EventMap & string
> = {
  [k in keyof EventMap & string as (Suffix extends string ? `${Prefix}.${k}.${Suffix}`: `${Prefix}.${k}`)]: EventMap[k][Accessor]
}

export type AfterInternalSuccessEmitArgs<O extends CommonDefinitionWithCaller> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Result<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
    & Abortable
    & O["custom"]
}

export type AfterInternalEmitArgs<O extends CommonDefinitionWithCaller> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & ResultOrError<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
    & Abortable
    & O["custom"]
}

export type AfterInternalErrorEmitArgsNoArgs<O extends Omit<CommonDefinitionWithCaller, "options">> = {
  emitArgs:
    ThisArg<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
    & Abortable
    & ErrorT
    & O["custom"]
}

export type AfterInternalErrorEmitArgs<O extends Omit<CommonDefinitionWithCaller, "options">> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
    & Abortable
    & ErrorT
    & O["custom"]
}

export type AfterInternalSuccessEmitArgsNoArgs<O extends CommonDefinitionWithCaller> = {
  emitArgs:
    ThisArg<O>
    & ResultOrError<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
    & Abortable
    & O["custom"]
}

export type AfterInternalEmitArgsNoArgs<O extends CommonDefinitionWithCaller, resultOrError = { error?: any }> = {
  emitArgs:
    ThisArg<O>
    & Result<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
    & Abortable
    & resultOrError
    & O["custom"]
}

export type BeforeInternalEmitArgsNoArgs<O extends CommonDefinitionWithCaller> = {
  emitArgs:
    ThisArg<O>
    & Caller<O>
    & ParentInvocationSymbol
    & Abortable
    & InvocationSymbol
    & O["custom"]
}

export type BeforeInternalEmitArgs<O extends CommonDefinitionWithCaller> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Caller<O>
    & ParentInvocationSymbol
    & Abortable
    & InvocationSymbol
    & O["custom"]
}


export type BeforeInternalEmitArgsNoArgsOrig<O extends CommonDefinitionWithCaller> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & Caller<O>
    & ParentInvocationSymbol
    & Abortable
    & InvocationSymbol
    & O["custom"]
}

export type BeforeStar<O extends CommonDefinition> = {
  emitArgs:
    (ThisArg<O>
    & Args<O>
    & InvocationSymbol
    & Abortable
    & O["custom"])
}

export type BeforeStarCaller<O extends CommonDefinitionWithCaller> = {
  emitArgs: BeforeStar<O>["emitArgs"]
    & { caller?: Caller<O>["caller"] }
    & { parentInvocationSymbol?: ParentInvocationSymbol["parentInvocationSymbol"] }
}

export type AfterStar<O extends CommonDefinition, resultOrError> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & InvocationSymbol
    & Abortable
    & O["custom"]
    & resultOrError
}

export type AfterStarCaller<O extends CommonDefinitionWithCaller, resultOrError> = {
  emitArgs: AfterStar<O, resultOrError>["emitArgs"]
    & { caller?: Caller<O>["caller"] }
    & { parentInvocationSymbol?: ParentInvocationSymbol["parentInvocationSymbol"] }
}

export type CommonDefinition = {
  args: any,
  thisArg: any,
  custom?: Record<string, any>
  isPromise?: boolean,
  options?: any
};

export type CommonDefinitionWithCaller = CommonDefinition & {
  caller: string
}


export type InternalEventDefinition = {
  isPromise: boolean,
  emitArgs: any,
  options?: any,
  returns?: any,
  returnEmitName: string | never,
}
