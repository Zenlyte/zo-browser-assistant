import assert from "node:assert/strict";
import { normalizeUrlToThreadId } from "../scripts/core/chat-store.js";

const a = normalizeUrlToThreadId("https://example.com/path?utm_source=x&ref=y");
const b = normalizeUrlToThreadId("https://example.com/path");
assert.equal(a, b);
assert.ok(a.length <= 140);
assert.ok(normalizeUrlToThreadId("not-a-url").startsWith("thread_"));
console.log("chat-store.test.js passed");
