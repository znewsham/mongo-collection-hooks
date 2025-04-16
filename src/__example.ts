import type {
  Document,
} from "mongodb";

type Generic<TSchema extends Document> = {
  thing: TSchema,
  cleanNumber: number,
  cleanString: string
}

type KeysOfType<T, U, B = false> = {
  [P in keyof T]: B extends true
    ? T[P] extends U
      ? never
      : P
    : T[P] extends U
      ? P
      : never;
}[keyof T];

// type OmitKeysOfType<T, U> = Omit<T, KeysOfType<T, U, false>>;


export class Example<TSchema extends Document> {
  constructor(thing: TSchema) {
    const _keys: KeysOfType<Generic<TSchema>, number> = "cleanNumber";

    const _aThing1: Omit<Generic<TSchema>, "cleanNumber"> = {
      cleanString: "string",
      thing
    };

    // const _aThing: OmitKeysOfType<Generic<TSchema>, number> = {

    // }
  }
}
