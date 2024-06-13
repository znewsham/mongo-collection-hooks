// These are defined here so I don't have to write the comment 10 times.

export type ArgsOrig<O extends {args: any}> = {
  /** The original arguments before any hooks mutated them */
  argsOrig: O["args"]
}

export type ThisArg<O extends {thisArg: any}> = {
  /** The instance of collection or cursor */
  thisArg: O["thisArg"]
}

export type Args<O extends {args: any}> = {
  /** The current arguments as mutated by any hooks ran before this one */
  args: O["args"]
}

export type Caller<O extends {caller: any}> = {
  /** The name of the call, for `before.insert` events this could be `insertMany` or `insertOne` */
  caller: O["caller"]
}

export type InvocationSymbol = {
  /** A unique identifier per hook pair. The before/after hook for a single request will have the same invocationSymbol */
  invocationSymbol: symbol;
}

export type ParentInvocationSymbol = {
  /** The parent invocations invocationSymbol. For internal events it identifies the parent call. e.g., for `before.insert` events it may be the relevant`before.insertMany` call */
  parentInvocationSymbol: symbol;
}

export type ErrorT = {
  /** The error caused by the action. Mutually exclusive with result */
  error: any
}

export type Result<O> = O extends {result: any} ? {
  /**The result of the call */
  result: O["result"]
} : {}

export type ResultOrig<O> = O extends {result: any} ? {
  /**The result of the call */
  resultOrig: O["result"]
} : {}
