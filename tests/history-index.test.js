import assert from "node:assert/strict";
import { sortHistory } from "../scripts/core/history-index.js";

const rows = sortHistory([
  { id: "a", updatedAt: 10 },
  { id: "b", updatedAt: 30 },
  { id: "c", updatedAt: 20 },
]);
assert.deepEqual(rows.map((r) => r.id), ["b", "c", "a"]);
console.log("history-index.test.js passed");
