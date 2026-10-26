"use client";

import { createContext, useContext, useEffect, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import { createInitialState, receiptReducer, type ReceiptAction, type ReceiptState } from "@/lib/receipt-state";
import { loadDraft, saveDraft, savePhoto } from "@/lib/persistence";

const StateContext = createContext<ReceiptState | null>(null);
const DispatchContext = createContext<Dispatch<ReceiptAction> | null>(null);

export function ReceiptProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(receiptReducer, undefined, createInitialState);
  const hydrated = useRef(false);

  // Restore the draft after mount so server and client render the same defaults.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) dispatch({ type: "replace", state: draft });
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    // Saving is off the input path: the receipt has already re-rendered by now.
    const id = window.setTimeout(() => saveDraft(state), 300);
    return () => window.clearTimeout(id);
  }, [state]);

  useEffect(() => {
    if (hydrated.current) savePhoto(state.hero.photo);
  }, [state.hero.photo]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useReceipt(): ReceiptState {
  const state = useContext(StateContext);
  if (!state) throw new Error("useReceipt must be used inside <ReceiptProvider>");
  return state;
}

export function useReceiptDispatch(): Dispatch<ReceiptAction> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error("useReceiptDispatch must be used inside <ReceiptProvider>");
  return dispatch;
}
