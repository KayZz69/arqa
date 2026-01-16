import test from "node:test";
import assert from "node:assert/strict";
import { filterItemsByQuery, normalizeQuery, matchesQuery } from "../src/lib/search.js";

test("normalizeQuery trims and lowercases", () => {
  assert.equal(normalizeQuery("  AbC  "), "abc");
});

test("matchesQuery returns true on empty query", () => {
  assert.equal(matchesQuery("Anything", ""), true);
});

test("filterItemsByQuery matches case-insensitive text", () => {
  const items = [
    { id: 1, name: "Milk", category: "Dairy" },
    { id: 2, name: "Sugar", category: "Dry" },
  ];

  const filtered = filterItemsByQuery(items, "milk", (item) => `${item.name} ${item.category}`);
  assert.deepEqual(filtered.map((item) => item.id), [1]);
});
