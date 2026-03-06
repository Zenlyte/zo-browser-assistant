import assert from "node:assert/strict";
import { buildOpenInZoUrl } from "../scripts/core/open-in-zo.js";

const url = buildOpenInZoUrl({ pageUrl: "https://example.com/a?b=c", pageTitle: "Hello world" });
const u = new URL(url);
assert.equal(u.hostname, "YOUR-HANDLE.zo.computer");
assert.equal(u.searchParams.get("source"), "chrome-extension");
assert.equal(u.searchParams.get("page_url"), "https://example.com/a?b=c");
assert.equal(u.searchParams.get("page_title"), "Hello world");
assert.ok(u.searchParams.get("thread_id"));
console.log("open-in-zo.test.js passed");
