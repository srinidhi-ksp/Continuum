import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Without this, each test's rendered DOM stays mounted for the next test
// in the same file (RTL's automatic cleanup needs a global afterEach hook,
// which is intentionally off here — see vitest.config `globals: false`).
afterEach(() => {
  cleanup();
});
