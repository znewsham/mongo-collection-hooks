import type { InferIdType } from "mongodb";

export type LimitedCursor<TSchema> = {
  next(): Promise<{ _id: InferIdType<TSchema> } | null> | { _id: InferIdType<TSchema> } | null
};

export type MaybeParalelReturnType = {
  type: "Break" | "Continue",
  result?: any,
  error?: any
};

/**
 * This is purely a performance optimisation - used by updateMany/deleteMany when update/delete hooks are present.
 * If we aren't running in ordered mode - we can run all the operations in parallel
 * Doing this might overwhelm the memory of the server (given that we may need to fetch a large document for each)
 * So we support batching.
 * The expectation is this function doesn't need to care about aggregating write results - it assumes fn will handle that
 * But it does support aggregating errors (though maybe doesn't need to :shrug:)
 */
export async function maybeParallel<
  TSchema
>(
  fn: (next: { _id: InferIdType<TSchema> }) => Promise<MaybeParalelReturnType>,
  cursor: LimitedCursor<TSchema>,
  ordered: boolean,
  batchSize: number = 1000,
  signal: AbortSignal | undefined,
  first?: { _id: InferIdType<TSchema> }
): Promise<any[]> {
  signal?.throwIfAborted();
  const errors: any[] = [];
  if (ordered) {
    let next = first || await cursor.next();
    while (next) {
      signal?.throwIfAborted();
      const returnType = await fn(next);
      signal?.throwIfAborted();
      if (returnType.error) {
        errors.push(returnType.error);
      }
      if (returnType.type === "Break") {
        break;
      }
      next = await cursor.next();
    }
  }
  else {
    let next = first || await cursor.next();
    while (next) {
      const batch: { _id: InferIdType<TSchema> }[] = [];
      while (next && batch.length < batchSize) {
        batch.push(next);
        signal?.throwIfAborted();
        next = await cursor.next();
      }
      signal?.throwIfAborted();
      await Promise.all(batch.map(async (nextItem) => {
        signal?.throwIfAborted();
        const returnType = await fn(nextItem);
        if (returnType.error) {
          errors.push(returnType.error);
        }
      }));
    }
  }
  return errors;
}
