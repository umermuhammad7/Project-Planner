import { createContext, useContext } from "react";

type ScrollAssistValue = {
  scrollToTop: () => void;
  scrollToOffset: (offset: number) => void;
};

const noop = () => {};

export const ScrollAssistContext = createContext<ScrollAssistValue>({
  scrollToTop: noop,
  scrollToOffset: noop
});

export function useScrollAssist() {
  return useContext(ScrollAssistContext);
}
