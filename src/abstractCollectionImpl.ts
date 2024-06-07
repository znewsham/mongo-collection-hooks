import { AggregateOptions, AggregationCursor, AnyBulkWriteOperation, BSONSerializeOptions, BulkWriteOptions, BulkWriteResult, ChangeStream, ChangeStreamDocument, ChangeStreamOptions, CollStats, CollStatsOptions, Collection, CommandOperationOptions, CountDocumentsOptions, CountOptions, CreateIndexesOptions, DeleteOptions, DeleteResult, DistinctOptions, Document, DropCollectionOptions, EnhancedOmit, EstimatedDocumentCountOptions, Filter, FindCursor, FindOneAndDeleteOptions, FindOneAndReplaceOptions, FindOneAndUpdateOptions, FindOptions, Hint, IndexDescription, IndexInformationOptions, IndexSpecification, InsertManyResult, InsertOneOptions, InsertOneResult, ListIndexesCursor, ListIndexesOptions, ListSearchIndexesCursor, ListSearchIndexesOptions, ModifyResult, OperationOptions, OptionalUnlessRequiredId, OrderedBulkOperation, ReadConcern, ReadPreference, RenameOptions, ReplaceOptions, SearchIndexDescription, UnorderedBulkOperation, UpdateFilter, UpdateOptions, UpdateResult, WithId, WithoutId, WriteConcern } from "mongodb"

export abstract class AbstractHookedCollection<TSchema extends Document> implements Collection<TSchema> {
  #collection: Collection<TSchema>
  constructor(collection: Collection<TSchema>) {
    this.#collection = collection;
  }
  get bsonOptions(): BSONSerializeOptions {
    return this.#collection.bsonOptions;
  }
  get collectionName(): string {
    return this.#collection.collectionName;
  }
  get dbName(): string {
    return this.#collection.dbName;
  }
  get hint(): Hint | undefined {
    return this.#collection.hint;
  }
  set hint(v: Hint | undefined) {
    this.#collection.hint = v;
  }
  get namespace(): string {
    return this.#collection.namespace;
  }
  get readConcern(): ReadConcern | undefined {
    return this.#collection.readConcern;
  }
  get readPreference(): ReadPreference | undefined {
    return this.#collection.readPreference;
  }
  get writeConcern(): WriteConcern | undefined {
    return this.#collection.writeConcern;
  }
  bulkWrite(operations: AnyBulkWriteOperation<TSchema>[], options?: BulkWriteOptions | undefined): Promise<BulkWriteResult> {
    return this.#collection.bulkWrite(operations, options);
  }
  countDocuments(filter?: Document | undefined, options?: CountDocumentsOptions | undefined): Promise<number> {
    return this.#collection.countDocuments(filter, options);
  }
  createIndex(indexSpec: IndexSpecification, options?: CreateIndexesOptions | undefined): Promise<string> {
    return this.#collection.createIndex(indexSpec, options);
  }
  createIndexes(indexSpecs: IndexDescription[], options?: CreateIndexesOptions | undefined): Promise<string[]> {
    return this.#collection.createIndexes(indexSpecs, options);
  }
  createSearchIndex(description: SearchIndexDescription): Promise<string> {
    return this.#collection.createSearchIndex(description);
  }
  createSearchIndexes(descriptions: SearchIndexDescription[]): Promise<string[]> {
    return this.#collection.createSearchIndexes(descriptions);
  }
  drop(options?: DropCollectionOptions | undefined): Promise<boolean> {
    return this.#collection.drop(options);
  }
  dropIndex(indexName: string, options?: CommandOperationOptions | undefined): Promise<Document> {
    return this.#collection.dropIndex(indexName, options);
  }
  dropIndexes(options?: CommandOperationOptions | undefined): Promise<Document> {
    return this.#collection.dropIndexes(options);
  }
  dropSearchIndex(name: string): Promise<void> {
    return this.#collection.dropSearchIndex(name);
  }
  estimatedDocumentCount(options?: EstimatedDocumentCountOptions | undefined): Promise<number> {
    return this.#collection.estimatedDocumentCount(options);
  }
  async findOneAndDelete(filter: Filter<TSchema>, options: FindOneAndDeleteOptions & { includeResultMetadata: true }): Promise<ModifyResult<TSchema>>;
  async findOneAndDelete(filter: Filter<TSchema>, options: FindOneAndDeleteOptions & { includeResultMetadata: false }): Promise<WithId<TSchema> | null>;
  async findOneAndDelete(filter: Filter<TSchema>, options: FindOneAndDeleteOptions): Promise<ModifyResult<TSchema>>;
  async findOneAndDelete(filter: Filter<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndDelete(filter: Filter<TSchema>, options?: FindOneAndDeleteOptions): Promise<WithId<TSchema> | ModifyResult<TSchema> | null> {
    if (options) {
      return this.#collection.findOneAndDelete(filter, options);
    }
    return this.#collection.findOneAndDelete(filter);
  }
  async findOneAndUpdate(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options: FindOneAndUpdateOptions & { includeResultMetadata: true; }): Promise<ModifyResult<TSchema>>;
  async findOneAndUpdate(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options: FindOneAndUpdateOptions & { includeResultMetadata: false; }): Promise<WithId<TSchema> | null>;
  async findOneAndUpdate(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options: FindOneAndUpdateOptions): Promise<WithId<TSchema> | null>;
  async findOneAndUpdate(filter: Filter<TSchema>, update: UpdateFilter<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndUpdate(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options?: FindOneAndUpdateOptions): Promise<ModifyResult<TSchema> | WithId<TSchema> | null> {
    if (options) {
      return this.#collection.findOneAndUpdate(filter, update, options);
    }
    return this.#collection.findOneAndUpdate(filter, update);
  }

  async findOneAndReplace(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options: FindOneAndReplaceOptions & { includeResultMetadata: true }): Promise<ModifyResult<TSchema>>;
  async findOneAndReplace(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options: FindOneAndReplaceOptions & { includeResultMetadata: false }): Promise<WithId<TSchema> | null>;
  async findOneAndReplace(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options: FindOneAndReplaceOptions): Promise<ModifyResult<TSchema>>;
  async findOneAndReplace(filter: Filter<TSchema>, replacement: WithoutId<TSchema>): Promise<ModifyResult<TSchema>>;
  async findOneAndReplace(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options?: FindOneAndReplaceOptions): Promise<WithId<TSchema> | ModifyResult<TSchema> | null> {
    if (options) {
      return this.#collection.findOneAndReplace(filter, replacement, options);
    }
    return this.#collection.findOneAndReplace(filter, replacement);
  }
  indexExists(indexes: string | string[], options?: IndexInformationOptions | undefined): Promise<boolean> {
    return this.#collection.indexExists(indexes, options);
  }
  indexInformation(options?: IndexInformationOptions | undefined): Promise<Document> {
    return this.#collection.indexInformation(options);
  }
  indexes(options?: IndexInformationOptions | undefined): Promise<Document[]> {
    return this.#collection.indexes(options);
  }
  initializeOrderedBulkOp(options?: BulkWriteOptions | undefined): OrderedBulkOperation {
    return this.#collection.initializeOrderedBulkOp(options);
  }
  initializeUnorderedBulkOp(options?: BulkWriteOptions | undefined): UnorderedBulkOperation {
    return this.#collection.initializeUnorderedBulkOp(options);
  }
  listIndexes(options?: ListIndexesOptions | undefined): ListIndexesCursor {
    return this.#collection.listIndexes(options);
  }
  listSearchIndexes(options?: AggregateOptions | undefined): ListSearchIndexesCursor;
  listSearchIndexes(name: string, options?: AggregateOptions | undefined): ListSearchIndexesCursor;
  listSearchIndexes(indexNameOrOptions?: string | ListSearchIndexesOptions, options?: ListSearchIndexesOptions): ListSearchIndexesCursor {
    if (typeof indexNameOrOptions === "string") {
      return this.#collection.listSearchIndexes(indexNameOrOptions, options);
    }
    return this.#collection.listSearchIndexes(options);
  }
  options(options?: OperationOptions | undefined): Promise<Document> {
    return this.#collection.options(options);
  }
  rename(newName: string, options?: RenameOptions | undefined): Promise<Collection<Document>> {
    return this.#collection.rename(newName, options);
  }
  isCapped(options?: OperationOptions | undefined): Promise<boolean> {
    return this.#collection.isCapped(options);
  }

  aggregate<T extends Document = Document>(pipeline?: Document[] | undefined, options?: AggregateOptions | undefined): AggregationCursor<T> {
    return this.#collection.aggregate(pipeline, options);
  }
  deleteMany(filter?: Filter<TSchema> | undefined, options?: DeleteOptions | undefined): Promise<DeleteResult> {
    return this.#collection.deleteMany(filter, options);
  }
  deleteOne(filter?: Filter<TSchema> | undefined, options?: DeleteOptions | undefined): Promise<DeleteResult> {
    return this.#collection.deleteOne(filter, options);
  }
  updateSearchIndex(name: string, definition: Document): Promise<void> {
    return this.#collection.updateSearchIndex(name, definition);
  }
  watch<TLocal extends Document = TSchema, TChange extends Document = ChangeStreamDocument<TLocal>>(pipeline?: Document[] | undefined, options?: ChangeStreamOptions | undefined): ChangeStream<TLocal, TChange> {
    return this.#collection.watch(pipeline, options);
  }
  stats(options?: CollStatsOptions | undefined): Promise<CollStats> {
    return this.#collection.stats(options);
  }

  abstract distinct(key: string): Promise<any[]>;
  abstract distinct(key: string, filter: Filter<TSchema>): Promise<any[]>;
  abstract distinct(key: string, filter: Filter<TSchema>, options: DistinctOptions): Promise<any[]>;
  abstract distinct<Key extends keyof WithId<TSchema>>(key: Key, filter: Filter<TSchema>, options: DistinctOptions): Promise<any[]>;

  abstract find(): FindCursor<WithId<TSchema>>;
  abstract find(filter: Filter<TSchema>, options?: FindOptions<Document> | undefined): FindCursor<WithId<TSchema>>;
  abstract find<T extends Document>(filter: Filter<TSchema>, options?: FindOptions<Document> | undefined): FindCursor<T>;
  abstract find(filter: Filter<TSchema>, options: FindOptions): FindCursor<WithId<TSchema>>;

  abstract findOne(): Promise<WithId<TSchema> | null>;
  abstract findOne(filter: Filter<TSchema>): Promise<WithId<TSchema> | null>;
  abstract findOne(filter: Filter<TSchema>, options: FindOptions<Document>): Promise<WithId<TSchema> | null>;
  abstract findOne<T = TSchema>(): Promise<T | null>;
  abstract findOne<T = TSchema>(filter: Filter<TSchema>): Promise<T | null>;
  abstract findOne<T = TSchema>(filter: Filter<TSchema>, options?: FindOptions<Document> | undefined): Promise<T | null>;
  abstract findOne(filter: Filter<TSchema>, options: FindOptions): Promise<WithId<TSchema> | null>;

  abstract insertMany(docs: OptionalUnlessRequiredId<TSchema>[], options?: BulkWriteOptions | undefined): Promise<InsertManyResult<TSchema>>;
  abstract insertOne(doc: OptionalUnlessRequiredId<TSchema>, options?: InsertOneOptions | undefined): Promise<InsertOneResult<TSchema>>;
  abstract replaceOne(filter: Filter<TSchema>, replacement: WithoutId<TSchema>, options?: ReplaceOptions | undefined): Promise<Document | UpdateResult<TSchema>>;
  abstract updateMany(filter: Filter<TSchema>, update: UpdateFilter<TSchema>, options?: UpdateOptions | undefined): Promise<UpdateResult<TSchema>>;
  abstract updateOne(filter: Filter<TSchema>, update: UpdateFilter<TSchema> | Partial<TSchema>, options?: UpdateOptions | undefined): Promise<UpdateResult<TSchema>>;
  abstract count(filter?: Filter<TSchema> | undefined, options?: CountOptions | undefined): Promise<number>;
}
