import { StandardDefineHookOptions } from "../awaiatableEventEmitter.js";
import { Args, ArgsOrig, Caller, ErrorT, InvocationSymbol, ParentInvocationSymbol, Result, ThisArg } from "../commentedTypes.js";


/**
 * @external
 */
export type RecursiveKeyOf<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]:
    RecursiveKeyOfHandleValue<TObj[TKey], `${TKey}`>;
}[keyof TObj & (string | number)];

type RecursiveKeyOfInner<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]:
    RecursiveKeyOfHandleValue<TObj[TKey], `.${TKey}`>;
}[keyof TObj & (string | number)];

/**
 * @external
 * @noFlatten
 */
type RecursiveKeyOfHandleValue<TValue, Text extends string> =
  TValue extends object[]
    ? Text | `${Text}${RecursiveKeyOfInner<TValue[0]>}`
    : TValue extends any[]
      ? Text
      : TValue extends object
        ? Text | `${Text}${RecursiveKeyOfInner<TValue>}`
        : Text;

/**
 * @external
 * @noFlatten
 */
export type RecursiveProjectionOf<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]:
  RecursiveProjectionOfHandleValue<TObj[TKey], `${TKey}`>;
}


/**
 * @external
 * @noFlatten
 */
type RecursiveProjectionOfHandleValue<TValue, Text extends string> =
  TValue extends object[]
    ? Text | `${Text}${RecursiveKeyOfInner<TValue[0]>}`
    : TValue extends any[]
      ? Text
      : TValue extends object
        ? Text | `${Text}${RecursiveKeyOfInner<TValue>}`
        : Text;

/**
 * @external
 * @noFlatten
 */
export type NestedProjectionOfTSchema<TObj extends object> = {
  [k in keyof TObj]?: TObj[k] extends object[]
    ? 1 | 0 | NestedProjectionOfTSchema<TObj[k][0]>
    : TObj[k] extends object
      ? 1 | 0 | NestedProjectionOfTSchema<TObj[k]>
      : 1 | 0
};



export type ReturnsNamedEmitArg<O extends {emitArgs: {[k in Key]: any}, isPromise?: boolean}, Key extends string> = O & {
  returns: O["emitArgs"][Key],
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

type ItemMapEntry = {
  emitArgs: any,
  isPromise: boolean
  options?: any,
  returnEmitName: string | never
}

export type BeforeAfterCallbackArgsAndReturn<
  BIM extends Record<string, ItemMapEntry>,
  BIMNames extends keyof BIM = keyof BIM
> = {
  [k in BIMNames]: {
    callbackArgs:
    {
      /** The original "thing", e.g. arguments, result, doc, or whatever before any hook was applied */
      [rek in BIM[k]["returnEmitName"] as `${rek}Orig`]: BIM[k] extends { returns: any } ? BIM[k]["returns"] : never
    } & BIM[k]["emitArgs"],
    emitArgs: BIM[k]["emitArgs"],
    returns: BIM[k] extends { returns: any } ? BIM[k]["returns"] : never,
    isPromise: BIM[k]["isPromise"],
    returnEmitName: BIM[k] extends { returnEmitName: never } ? undefined : BIM[k]["returnEmitName"],
    options: BIM[k] extends { options: StandardDefineHookOptions } ? BIM[k]["options"] : StandardDefineHookOptions
  }
}


export type ExtractEventDefinitions<
  EventMap extends Record<string, { before?: any, after?: any, error?: any }>,
  Prefix extends string,
  Accessor extends "before" | "after" | "error",
  Suffix extends string | number = number,
  K extends keyof EventMap & string = keyof EventMap & string
> = {
  [k in K as (Suffix extends string ? `${Prefix}.${k}.${Suffix}`: `${Prefix}.${k}`)]: EventMap[k][Accessor]
}

export type AfterInternalEmitArgs<O extends CommonDefinitionWithCaller> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & ArgsOrig<O>
    & Result<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
    & O["custom"]
}

export type AfterInternalErrorEmitArgsNoArgs<O extends Omit<CommonDefinitionWithCaller, "options">> = {
  emitArgs:
    ThisArg<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
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
    & ErrorT
    & O["custom"]
}

export type AfterInternalEmitArgsNoArgs<O extends CommonDefinitionWithCaller> = {
  emitArgs:
    ThisArg<O>
    & Result<O>
    & Caller<O>
    & InvocationSymbol
    & ParentInvocationSymbol
    & O["custom"]
}

export type BeforeInternalEmitArgsNoArgs<O extends CommonDefinitionWithCaller> = {
  emitArgs:
    ThisArg<O>
    & Caller<O>
    & ParentInvocationSymbol
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
    & InvocationSymbol
    & O["custom"]
}

export type BeforeInternalEmitArgsNoArgsOrig<O extends CommonDefinitionWithCaller> = {
  emitArgs:
    ThisArg<O>
    & Args<O>
    & Caller<O>
    & ParentInvocationSymbol
    & InvocationSymbol
    & O["custom"]
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
