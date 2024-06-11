import type { FindCursor } from "mongodb";

export interface HookedFindCursorInterface<TSchema> extends FindCursor<TSchema> {

}
