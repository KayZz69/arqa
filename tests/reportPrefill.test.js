import test from "node:test";
import assert from "node:assert/strict";
import { applyPrefillFromYesterday, getPrefillableCount } from "../src/lib/reportPrefill.js";

test("getPrefillableCount ignores existing report items", () => {
  const reportItems = {
    b: { position_id: "b", ending_stock: 1, write_off: 0 },
  };
  const previousItems = { a: 4, b: 2 };
  const positions = [{ id: "a" }, { id: "b" }];

  const count = getPrefillableCount({ reportItems, previousItems, positions });
  assert.equal(count, 1);
});

test("applyPrefillFromYesterday fills missing items and keeps existing ones", () => {
  const reportItems = {
    b: { position_id: "b", ending_stock: 1, write_off: 0 },
  };
  const previousItems = { a: 4, b: 2 };
  const previousDayData = {
    a: { ending_stock: 5, arrivals: 2 },
    b: { ending_stock: 1, arrivals: 1 },
  };
  const positions = [{ id: "a" }, { id: "b" }];

  const result = applyPrefillFromYesterday({
    reportItems,
    previousItems,
    previousDayData,
    positions,
  });

  assert.equal(result.b.ending_stock, 1);
  assert.equal(result.a.ending_stock, 4);
  assert.equal(result.a.write_off, 3);
});
