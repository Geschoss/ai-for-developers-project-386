import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// oxlint-disable-next-line eslint/no-empty-function -- jsdom has no matchMedia; the listeners are never called
const ignore = (): void => {};

// Mantine reads color-scheme media queries, which jsdom lacks.
const mediaQueryList = (query: string): MediaQueryList => ({
  addEventListener: ignore,
  // oxlint-disable-next-line typescript/no-deprecated -- the MediaQueryList type still requires this legacy method
  addListener: ignore,
  dispatchEvent: (): boolean => false,
  matches: false,
  media: query,
  // oxlint-disable-next-line unicorn/no-null -- MediaQueryList.onchange is null until a listener is set
  onchange: null,
  removeEventListener: ignore,
  // oxlint-disable-next-line typescript/no-deprecated -- the MediaQueryList type still requires this legacy method
  removeListener: ignore,
});

globalThis.matchMedia ??= mediaQueryList;
