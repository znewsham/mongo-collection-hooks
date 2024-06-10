import type { Document } from "mongodb";
import { NestedProjectionOfTSchema } from "./events.js";

export function isProjectionExclusion<TSchema extends Document>(projection: NestedProjectionOfTSchema<TSchema>, isTop: boolean = false) {
  const first = isTop ? Object.entries(projection).find(([key]) => key !== "_id")?.[1] : Object.values(projection)[0];
  if (first === undefined) {
    return false;
  }
  if (typeof first === "object") {
    return false;
  }
  return !first;
}

export function combineProjections<TSchema extends Document>(
  left: NestedProjectionOfTSchema<TSchema> | 0 | 1 | false | true |undefined,
  right: NestedProjectionOfTSchema<TSchema> | 0 | 1 | false | true | undefined,
  leftParentIsExclusion: boolean,
  rightParentIsExclusion: boolean,
  depth: number = 0
) : {
  isExclusion: boolean,
  projection: NestedProjectionOfTSchema<TSchema> | 0 | 1 | null,
  hasNestedKeys: boolean
} {
  if (left === 0 && right === 0) {
    return {
      isExclusion: true,
      projection: 0,
      hasNestedKeys: false
    };
  }
  if (left === 1 && right === 1) {
    return {
      isExclusion: false,
      projection: 1,
      hasNestedKeys: false
    };
  }
  if (left === 0 || right === 0) {
    const other = left === 0 ? right : left;
    const otherParentIsExclusion = left === 0 ? rightParentIsExclusion : leftParentIsExclusion;
    if (typeof other === "object") {
      const otherIsExclusion = isProjectionExclusion(other as NestedProjectionOfTSchema<TSchema>, false);
      return {
        isExclusion: !otherIsExclusion,
        projection: otherIsExclusion ? other : {},
        hasNestedKeys: otherIsExclusion
      }
    }
    // if we're explicitly excluding this and the other isn't provided, but is part of an inclusion, we're fine to exclude it to
    else if (other === 1 || (other === undefined && otherParentIsExclusion)) {
      return {
        isExclusion: false,
        projection: {},
        hasNestedKeys: false
      };
    }
    else {
      return {
        isExclusion: true,
        projection: 0,
        hasNestedKeys: false
      };
    }
  }
  if (left === 1 || right === 1) {
    const other = left === 1 ? right : left;
    const otherParentIsExclusion = left === 1 ? rightParentIsExclusion : leftParentIsExclusion;
    if (typeof other === "object") {
      const otherIsExclusion = isProjectionExclusion(other as NestedProjectionOfTSchema<TSchema>, false);
      return {
        isExclusion: false,
        projection: 1,
        hasNestedKeys: false
      }
    }
    else if (other === undefined && otherParentIsExclusion) {
      return {
        isExclusion: false,
        projection: null,
        hasNestedKeys: false
      };
    }
    else {
      return {
        isExclusion: false,
        projection: 1,
        hasNestedKeys: false
      };
    }
  }
  // at this point both left and right are objects.
  let result: NestedProjectionOfTSchema<TSchema> | 0 | 1 = {};
  const exclusionKeys = new Set<string>();
  let isExclusion = false;
  let hasKeys = true;
  const allKeys = Array.from(new Set([
    ...Object.keys(left || {}),
    ...Object.keys(right || {})
  ]));

  const isTop = depth === 0;
  const leftIsExclusion = left && typeof left === "object" ? isProjectionExclusion(left, false) : leftParentIsExclusion;
  const rightIsExclusion = right && typeof right === "object" ? isProjectionExclusion(right, false) : rightParentIsExclusion;
  allKeys.every((key) => {
    const leftValue = left ? left[key]: undefined;
    const rightValue = right ? right[key] : undefined;
    // _id is a special case at the top level.
    if (isTop && key === "_id") {
      if ((leftValue === 0 || leftValue === false) && (rightValue === 0 || rightValue === false)) {
        result["_id"] = 0;
        return true;
      }
      else if(!(leftValue === 0 || leftValue === false) || !(rightValue === 0 || rightValue === false)) {
        return true;
      }
    }
    const partialResult = combineProjections(leftValue, rightValue, leftIsExclusion, rightIsExclusion, depth + 1);
    isExclusion = isExclusion || partialResult.isExclusion;
    if (partialResult.isExclusion) {
      exclusionKeys.add(key);
    }
    if (partialResult.projection === null) {
      // do nothing - this happens when the top level is { a: 1 }, { b: 0 } we get null for a, and exclusion for b.
    }
    else if (typeof partialResult.projection === "object" && !partialResult.hasNestedKeys) {
      result = 1;
      hasKeys = false;
      // if we get here, there's a mismatch - e.g., a: 1, a: 0
      return false;
    }
    else {
      result[key] = partialResult.projection;
    }
    return true;
  });
  return {
    isExclusion: false,
    projection: isExclusion ? Object.fromEntries(Object.entries(result).filter(([key]) => exclusionKeys.has(key as string))) as NestedProjectionOfTSchema<TSchema> : result,
    hasNestedKeys: hasKeys
  };
}
export function unionOfProjections<TSchema extends Document>(projections: NestedProjectionOfTSchema<TSchema>[]): NestedProjectionOfTSchema<TSchema> {
  let result: NestedProjectionOfTSchema<TSchema> = projections[0] || {};
  projections.slice(1).forEach((projection) => {
    result = combineProjections(result, projection, false, false)?.projection as NestedProjectionOfTSchema<TSchema>;
  });

  return result;
}
