import "@testing-library/jest-dom/vitest";
import { addEqualityTesters } from "@effect/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

addEqualityTesters();

// One document, one render at a time: each test leaves it as it found it.
afterEach(cleanup);
