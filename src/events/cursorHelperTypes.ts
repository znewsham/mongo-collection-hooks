import { StandardDefineHookOptions } from "../awaiatableEventEmitter.js";
import { ResultOrError } from "./commentedTypes.js";
import { AfterInternalSuccessEmitArgs, AfterInternalSuccessEmitArgsNoArgs, AfterInternalErrorEmitArgsNoArgs, BeforeInternalEmitArgsNoArgs, BeforeInternalEmitArgsNoArgsOrig, CommonDefinition, NoReturns, ReturnsArgs, ReturnsResult, AfterInternalEmitArgsNoArgs } from "./helpersTypes.js";

type StripCaller<O extends { emitArgs: { caller: any } }> = {
  emitArgs: Omit<O["emitArgs"], "caller">
}

export type CursorParams<
  HookedCursorType,
  CO extends { isPromise?: boolean, custom?: any },
  O extends (CommonDefinition & CO & { caller: any }) = {
    args: never,
    thisArg: HookedCursorType,
    caller: "never"
  } & CO
> = {
  before: NoReturns<CO> & StripCaller<BeforeInternalEmitArgsNoArgs<O>>
  success: NoReturns<CO> & StripCaller<AfterInternalSuccessEmitArgsNoArgs<O>>
  error: NoReturns<CO> & StripCaller<AfterInternalErrorEmitArgsNoArgs<O>>
  after: NoReturns<CO> & StripCaller<AfterInternalEmitArgsNoArgs<O>>
  caller: never
};

export type CursorParamsWithCaller<
  HookedCursorType,
  CO extends { caller: string, isPromise?: boolean },
  O extends (CommonDefinition & CO) = {
    args: never,
    thisArg: HookedCursorType,
  } & CO
> = {
  before: NoReturns<CO> & BeforeInternalEmitArgsNoArgs<O>
  success: NoReturns<CO> & AfterInternalSuccessEmitArgsNoArgs<O>
  error: NoReturns<CO> & AfterInternalErrorEmitArgsNoArgs<O>
  after: NoReturns<CO> & AfterInternalEmitArgsNoArgs<O>
  caller: CO["caller"]
};

export type CursorParamsWithResult<
  HookedCursorType,
  CO extends { result: any, custom?: any },
  O extends (CommonDefinition & CO & { caller: any }) = ({
    args: never,
    thisArg: HookedCursorType,
    caller: "never"
  } & CO)
> = {
  before: NoReturns & StripCaller<BeforeInternalEmitArgsNoArgs<O>>
  success: ReturnsResult<O> & StripCaller<AfterInternalSuccessEmitArgsNoArgs<O>>
  error: NoReturns & StripCaller<AfterInternalErrorEmitArgsNoArgs<O>>
  after: ReturnsResult<O> & StripCaller<AfterInternalEmitArgsNoArgs<O, ResultOrError<O>>>
  caller: never
};

export type CursorParamsWithArgs<
  HookedCursorType,
  CO extends { args: any, custom?: any },
  O extends (CommonDefinition & CO & { caller: any }) = {
    thisArg: HookedCursorType,
    options: StandardDefineHookOptions
    caller: "never",
  } & CO
> = {
  before: ReturnsArgs<O> & StripCaller<BeforeInternalEmitArgsNoArgsOrig<O>>
  success: NoReturns & StripCaller<AfterInternalSuccessEmitArgs<O>>,
  error: NoReturns & StripCaller<AfterInternalErrorEmitArgsNoArgs<O>>
  after: NoReturns & StripCaller<AfterInternalEmitArgsNoArgs<O>>
  caller: never
};

export type CursorParamsWithArgsAndResult<
  HookedCursorType,
  CO extends { result: any, args: any, isPromise?: boolean },
  O extends (CommonDefinition & CO & { caller: any }) = {
    thisArg: HookedCursorType,
    options: StandardDefineHookOptions,
    caller: "never"
  } & CO
> = {
  before: ReturnsArgs<O> & StripCaller<BeforeInternalEmitArgsNoArgsOrig<O>>
  success: ReturnsResult<O> & StripCaller<AfterInternalSuccessEmitArgsNoArgs<O>>
  error: NoReturns & StripCaller<AfterInternalErrorEmitArgsNoArgs<O>>
  after: ReturnsResult<O> & StripCaller<AfterInternalEmitArgsNoArgs<O, ResultOrError<O>>>
  caller: never
};
