import { test } from "node:test";
import assert from "node:assert/strict";
import { diffPreview } from "./diff-preview";

test("reports a changed line as one removal and one addition", () => {
  const d = diffPreview("# Pricing\nPro: $10", "# Pricing\nPro: $12");
  assert.equal(d.totalAdded, 1);
  assert.equal(d.totalRemoved, 1);
  assert.equal(d.preview, "+ Pro: $12\n- Pro: $10");
});

test("an added copy of an existing line counts as an addition", () => {
  const before = "## Plans\n- Includes support\n## Add-ons";
  const after = "## Plans\n- Includes support\n## Add-ons\n- Includes support";
  const d = diffPreview(before, after);
  assert.equal(d.totalAdded, 1);
  assert.equal(d.totalRemoved, 0);
  assert.equal(d.preview, "+ - Includes support");
});

test("removing one of two identical lines counts as a removal", () => {
  const d = diffPreview("a\n\nb\n\nc", "a\n\nb\nc");
  assert.equal(d.totalAdded, 0);
  assert.equal(d.totalRemoved, 1);
  assert.equal(d.preview, "- ");
});

test("identical input produces an empty preview", () => {
  const d = diffPreview("a\nb\na", "a\nb\na");
  assert.deepEqual(d, { preview: "", totalAdded: 0, totalRemoved: 0 });
});
