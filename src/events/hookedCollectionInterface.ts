import type { Collection, Document } from "mongodb";

export interface HookedCollectionInterface<TSchema extends Document = Document> extends Collection<TSchema> {

}
