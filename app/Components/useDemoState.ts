"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

/** In-memory UI state for the standalone frontend handoff. */
export default function useDemoState<T>(
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  return [value, setValue, true];
}
