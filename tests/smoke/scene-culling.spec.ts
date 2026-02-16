import { expect, test } from "@playwright/test";
import { resolveDistanceCulledItems } from "../../web/src/lib/scene-culling";

test("distance culling drops non-critical props outside the max distance", () => {
  const visible = resolveDistanceCulledItems({
    items: [
      { id: "near-1", position: [0, 0, 0] as [number, number, number] },
      { id: "near-2", position: [3, 0, 4] as [number, number, number] },
      { id: "far-1", position: [20, 0, 20] as [number, number, number] },
    ],
    maxVisibleCount: 3,
    focalPoint: [0, 0, 0],
    maxDistance: 8,
  });

  expect(visible.map((item) => item.id)).toEqual(["near-1", "near-2"]);
});

test("distance culling still honors visible-count caps after filtering", () => {
  const visible = resolveDistanceCulledItems({
    items: [
      { id: "a", position: [0, 0, 0] as [number, number, number] },
      { id: "b", position: [2, 0, 0] as [number, number, number] },
      { id: "c", position: [4, 0, 0] as [number, number, number] },
    ],
    maxVisibleCount: 2,
    focalPoint: [0, 0, 0],
    maxDistance: 10,
  });

  expect(visible).toHaveLength(2);
  expect(visible.map((item) => item.id)).toEqual(["a", "b"]);
});

test("distance culling falls back to source order when threshold excludes all items", () => {
  const visible = resolveDistanceCulledItems({
    items: [
      { id: "first", position: [20, 0, 20] as [number, number, number] },
      { id: "second", position: [22, 0, 20] as [number, number, number] },
    ],
    maxVisibleCount: 1,
    focalPoint: [0, 0, 0],
    maxDistance: 5,
  });

  expect(visible.map((item) => item.id)).toEqual(["first"]);
});
