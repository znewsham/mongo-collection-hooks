import { StandardDefineHookOptions } from "../awaiatableEventEmitter.js";
import { AfterInternalSuccessEmitArgs, AfterInternalSuccessEmitArgsNoArgs, AfterInternalErrorEmitArgs, AfterInternalErrorEmitArgsNoArgs, BeforeInternalEmitArgs, BeforeInternalEmitArgsNoArgs, BeforeInternalEmitArgsNoArgsOrig, CommonDefinition, NoReturns, ReturnsArgs, ReturnsResult, AfterInternalEmitArgsNoArgs } from "./helpersTypes.js";

export type CursorParams<
  HookedCursorType,
  CO extends { caller: string, isPromise?: boolean },
  O extends (CommonDefinition & CO) = {
    args: never,
    thisArg: HookedCursorType,
    isPromise: CO["isPromise"],
  } & CO
> = {
  before: NoReturns<CO> & BeforeInternalEmitArgsNoArgs<O> & { caller: CO["caller"] }
  success: NoReturns<CO> & AfterInternalSuccessEmitArgsNoArgs<O> & { caller: CO["caller"] }
  error: NoReturns<CO> & AfterInternalErrorEmitArgsNoArgs<O> & { caller: CO["caller"] }
  after: NoReturns<CO> & AfterInternalEmitArgsNoArgs<O> & { caller: CO["caller"] }
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
  success: ReturnsResult<O> & AfterInternalSuccessEmitArgsNoArgs<O> & { caller: CO["caller"] }
  error: NoReturns & AfterInternalErrorEmitArgsNoArgs<O> & { caller: CO["caller"] }
  after: ReturnsResult<O> & AfterInternalEmitArgsNoArgs<O> & { caller: CO["caller"] }
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
  success: NoReturns & AfterInternalSuccessEmitArgs<O> & { caller: CO["caller"] },
  error: NoReturns & AfterInternalErrorEmitArgsNoArgs<O> & { caller: CO["caller"] }
  after: NoReturns & AfterInternalEmitArgsNoArgs<O> & { caller: CO["caller"] }
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
  success: ReturnsResult<O> & AfterInternalSuccessEmitArgsNoArgs<O> & { caller: CO["caller"] }
  error: NoReturns & AfterInternalErrorEmitArgsNoArgs<O> & { caller: CO["caller"] }
  after: ReturnsResult<O> & AfterInternalEmitArgsNoArgs<O> & { caller: CO["caller"] }
  caller: CO["caller"]
};
