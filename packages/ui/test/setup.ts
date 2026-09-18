import "@testing-library/jest-dom/vitest";
import { addEqualityTesters } from "@effect/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

addEqualityTesters();

// Component tests share one document, so each must leave it as it found it.
afterEach(cleanup);
