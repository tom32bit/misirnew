import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// jsdom keeps the document between tests in the same file; without this a query
// like getByRole can match a node left behind by an earlier test.
afterEach(() => {
  cleanup()
})
