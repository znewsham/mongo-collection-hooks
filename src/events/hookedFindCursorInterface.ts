import type { FindCursor } from "mongodb";

export interface HookedFindCursorInterface<TSchema = any> extends FindCursor<TSchema> {

}
