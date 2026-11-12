"use client";

import { createContext, useContext } from "react";

// 左のカードから右のペインへ頼む操作(どのリストのカードからでも使えるように)
export const CardActionsContext = createContext<{
  requestConnect: (id: number) => void;
}>({ requestConnect: () => {} });

export function useCardActions() {
  return useContext(CardActionsContext);
}
