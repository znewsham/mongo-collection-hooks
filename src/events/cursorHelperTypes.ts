import { StandardDefineHookOptions } from "../awaiatableEventEmitter.js";
import { AfterInternalEmitArgs, AfterInternalEmitArgsNoArgs, AfterInternalErrorEmitArgs, AfterInternalErrorEmitArgsNoArgs, BeforeInternalEmitArgs, BeforeInternalEmitArgsNoArgs, BeforeInternalEmitArgsNoArgsOrig, CommonDefinition, NoReturns, ReturnsArgs, ReturnsResult } from "./helpersTypes.js";

type BuildHook<O extends {}> = {
  [k in keyof O & ("result" | "emitArgs" | "options" | "returnEmitName" | "isPromise")]: O[k]
}

export type CursorParams<
  HookedCursorType,
  CO extends { caller: string },
  O extends (CommonDefinition & CO) = {
    args: never,
    thisArg: HookedCursorType,
    isPromise: true,
  } & CO
> = {
  before: NoReturns & BeforeInternalEmitArgsNoArgs<O> & { caller: CO["caller"] }
  after: NoReturns & AfterInternalEmitArgsNoArgs<O> & { caller: CO["caller"] }
  error: NoReturns & AfterInternalErrorEmitArgsNoArgs<O> & { caller: CO["caller"] }
  caller: CO["caller"]
};

export type CursorParamsWithResult<
  HookedCursorType,
  CO extends { caller: string, result: any },
  O extends (CommonDefinition & CO) = ({
    args: never,
    thisArg: HookedCursorType,
  } & CO)
> = {
  before: NoReturns & BeforeInternalEmitArgsNoArgs<O> & { caller: CO["caller"] }
  after: ReturnsResult<O> & AfterInternalEmitArgsNoArgs<O> & { caller: CO["caller"] }
  error: NoReturns & AfterInternalErrorEmitArgsNoArgs<O> & { caller: CO["caller"] }
  caller: CO["caller"]
};

export type CursorParamsWithArgs<
  HookedCursorType,
  CO extends { caller: string, result: any, args: any },
  O extends (CommonDefinition & CO) = {
    thisArg: HookedCursorType,
    options: StandardDefineHookOptions
  } & CO
> = {
  before: ReturnsArgs<O> & BeforeInternalEmitArgsNoArgsOrig<O> & { caller: CO["caller"] }
  after: NoReturns & AfterInternalEmitArgs<O> & { caller: CO["caller"] },
  error: NoReturns & AfterInternalErrorEmitArgsNoArgs<O> & { caller: CO["caller"] }
  caller: CO["caller"]
};

export type CursorParamsWithArgsAndResult<
  HookedCursorType,
  CO extends { caller: string, result: any, args: any, isPromise?: boolean },
  O extends (CommonDefinition & CO) = {
    thisArg: HookedCursorType,
    options: StandardDefineHookOptions
  } & CO
> = {
  before: ReturnsArgs<O> & BeforeInternalEmitArgsNoArgsOrig<O> & { caller: CO["caller"] }
  after: ReturnsResult<O> & AfterInternalEmitArgsNoArgs<O> & { caller: CO["caller"] }
  error: NoReturns & AfterInternalErrorEmitArgsNoArgs<O> & { caller: CO["caller"] }
  caller: CO["caller"]
};
