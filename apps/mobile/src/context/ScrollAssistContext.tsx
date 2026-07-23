import { createContext, useContext } from "react";
import type { Component } from "react";

type ScrollAssistValue = {
  scrollToTop: () => void;
  scrollToOffset: (offset: number) => void;
  scrollToBottom: () => void;
  scrollIntoView: (node: Component | null, extraOffset?: number) => void;
};

const noop = () => {};

export const ScrollAssistContext = createContext<ScrollAssistValue>({
  scrollToTop: noop,
  scrollToOffset: noop,
  scrollToBottom: noop,
  scrollIntoView: noop
});

export function useScrollAssist() {
  return useContext(ScrollAssistContext);
}
