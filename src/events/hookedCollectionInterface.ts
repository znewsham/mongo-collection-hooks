import type { Collection, Document } from "mongodb";

export interface HookedCollectionInterface<TSchema extends Document> extends Collection<TSchema> {

}
