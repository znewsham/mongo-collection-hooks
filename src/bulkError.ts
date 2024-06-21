import type{
  Document,
  MongoBulkWriteError,
  WriteConcernError,
  BulkWriteResult as MongoBulkWriteResult,
  TopologyVersion,
  OneOrMore,
  WriteError
} from 'mongodb';


export type BulkResult = {
  ok: number;
  deletedCount: number;
  insertedCount: number;
  insertedIds: { [key: number]: any; };
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
  upsertedIds: { [key: number]: any; }
}

export class BulkWriteResult implements Omit<MongoBulkWriteResult, "result">, BulkResult {
  #writeErrors: WriteError[];
  deletedCount: number;
  insertedCount: number;
  insertedIds: { [key: number]: any; };
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
  upsertedIds: { [key: number]: any; };

  constructor(bulkResult: BulkResult, writeErrors: WriteError[] = []) {
    this.deletedCount = bulkResult.deletedCount;
    this.insertedCount = bulkResult.insertedCount;
    this.insertedIds = bulkResult.insertedIds;
    this.matchedCount = bulkResult.matchedCount;
    this.modifiedCount = bulkResult.modifiedCount;
    this.upsertedCount = bulkResult.upsertedCount;
    this.upsertedIds = bulkResult.upsertedIds;
    this.#writeErrors = writeErrors;
    this.result = bulkResult;
  }

  get nInserted() {
    return this.insertedCount;
  }

  get nMatched() {
    return this.matchedCount;
  }

  get nModified() {
    return this.modifiedCount;
  }

  get nRemoved() {
    return this.deletedCount;
  }

  get nUpserted() {
    return this.upsertedCount;
  }

  getInsertedIds(): Document[] {
    return Object.values(this.insertedIds);
  }

  getUpsertedIds(): Document[] {
    return Object.values(this.upsertedIds);
  }

  getRawResponse(): Document {
    return {};
  }
  getUpsertedIdAt(index: number): Document | undefined {
    return undefined;
  }
  getWriteConcernError(): WriteConcernError | undefined {
    return undefined;
  }
  getWriteErrorAt(index: number): WriteError | undefined {
    return undefined;
  }
  getWriteErrorCount(): number {
    return 0;
  }
  getWriteErrors(): WriteError[] {
    return this.#writeErrors;
  }
  hasWriteErrors(): boolean {
    return !!this.#writeErrors.length;
  }
  isOk(): boolean {
    return this.ok === 1;
  }
  get ok(): number {
    return this.#writeErrors.length === 0 ? 1 : 0;
  }
  toString(): string {
    return "";
  }
}

export class BulkWriteError extends Error implements Omit<MongoBulkWriteError, "result"> {
  #result: BulkWriteResult;
  #errorLabels = new Set<string>();
  cause?: Error;
  code?: string | number | undefined;
  codeName?: string | undefined;
  connectionGeneration?: number | undefined;
  err?: WriteConcernError | undefined;
  errInfo?: Document | undefined;
  message: string;
  name: string = "BulkWriteError";
  ok?: 0;
  stack?: string | undefined;
  topologyVersion?: TopologyVersion | undefined;
  writeConcernError?: Document | undefined;
  constructor(message: string, result: BulkWriteResult) {
    super(message);
    this.message = message;
    this.#result = result;
  }
  addErrorLabel(label: string): void {
    this.#errorLabels.add(label);
  }

  get writeErrors(): OneOrMore<WriteError> {
    return this.#result.getWriteErrors();
  }

  get deletedCount(): number {
    return this.#result.deletedCount;
  }
  get insertedCount(): number {
    return this.#result.insertedCount;
  }
  get insertedIds(): { [key: number]: any; } {
    return this.#result.insertedIds;
  }
  get matchedCount(): number {
    return this.#result.matchedCount;
  }
  get modifiedCount(): number {
    return this.#result.modifiedCount;
  }
  get upsertedCount(): number {
    return this.#result.upsertedCount;
  }
  get upsertedIds(): { [key: number]: any; } {
    return this.#result.upsertedIds;
  }
  get errmsg(): string {
    return this.message;
  }
  get errorLabels(): string[] {
    return Array.from(this.#errorLabels);
  }
  hasErrorLabel(label: string): boolean {
    return this.#errorLabels.has(label);
  }
}
