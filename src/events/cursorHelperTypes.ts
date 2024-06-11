import { StandardDefineHookOptions } from "../awaiatableEventEmitter.js";
import { AfterInternalEmitArgs, AfterInternalErrorEmitArgs, BeforeInternalEmitArgs, CommonDefinition, NoReturns, ReturnsArgs, ReturnsResult } from "./helpersTypes.js";


export type CursorParams<
  HookedCursorType,
  CO extends { caller: string },
  O extends CommonDefinition = {
    args: never,
    thisArg: HookedCursorType,
    isPromise: true,
    options: StandardDefineHookOptions
  }
> = {
  before: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">,
    returns: never
  },
  after: Omit<NoReturns<AfterInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<AfterInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">,
    returns: never
  },
  error: Omit<NoReturns<AfterInternalErrorEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<AfterInternalErrorEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">,
    returns: never
  },
  caller: CO["caller"]
};

export type CursorParamsWithResult<
  HookedCursorType,
  CO extends { caller: string, result: any },
  O extends CommonDefinition = {
    args: never,
    thisArg: HookedCursorType,
    options: StandardDefineHookOptions
  } & CO
> = {
  before: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">,
    returns: never
  },
  after: Omit<ReturnsResult<AfterInternalEmitArgs<O & CO>>, "emitArgs"> & {
    emitArgs: Omit<ReturnsResult<AfterInternalEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
  error: Omit<NoReturns<AfterInternalErrorEmitArgs<O & CO>>, "emitArgs"> & {
    returnEmitName: never,
    emitArgs: Omit<NoReturns<AfterInternalErrorEmitArgs<O & CO>>["emitArgs"], "args" | "argsOrig">
  },
  caller: CO["caller"]
};

export type CursorParamsWithArgs<
  HookedCursorType,
  CO extends { caller: string, result: any, args: any },
  O extends CommonDefinition = {
    thisArg: HookedCursorType,
    options: StandardDefineHookOptions
  } & CO
> = {
  before: Omit<ReturnsArgs<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    emitArgs: Omit<ReturnsArgs<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "argsOrig">,
  },
  after: NoReturns<AfterInternalEmitArgs<O & CO>>,
  error: NoReturns<AfterInternalErrorEmitArgs<O & CO>>,
  caller: CO["caller"]
};

export type CursorParamsWithArgsAndResult<
  HookedCursorType,
  CO extends { caller: string, result: any, args: any, isPromise?: boolean },
  O extends CommonDefinition = {
    thisArg: HookedCursorType,
    options: StandardDefineHookOptions
  } & CO
> = {
  before: Omit<ReturnsArgs<BeforeInternalEmitArgs<O & CO>>, "emitArgs"> & {
    emitArgs: Omit<ReturnsArgs<BeforeInternalEmitArgs<O & CO>>["emitArgs"], "argsOrig">
  },
  after: ReturnsResult<AfterInternalEmitArgs<O & CO>>,
  error: NoReturns<AfterInternalErrorEmitArgs<O & CO>>,
  caller: CO["caller"]
};
