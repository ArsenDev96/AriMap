import { describe, expect, it } from "vitest";
import { placeLabels, textWidth, type LabelRequest } from "./labels";

const viewport = { width: 300, height: 200 };
const request = (id: string, anchor: [number, number], extra: Partial<LabelRequest> = {}): LabelRequest => ({ id, text: id, anchor, width: 200, small: false, badge: false, ...extra });
const overlap = (a: { x0: number; x1: number; y0: number; y1: number }, b: typeof a) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe("country names on the lesson map", () => {
  it("are centred on their label points", () => {
    const [label] = placeLabels([request("France", [150, 100])], [], viewport);
    expect(label.at).toEqual([150, 100]);
    expect(label.callout).toBeNull();
  });

  it("move clear of a marker and of each other", () => {
    const marker = { x0: 140, y0: 93, x1: 160, y1: 107 };
    const labels = placeLabels([request("Belgium", [150, 100]), request("Germany", [150, 100])], [marker], viewport);
    for (const l of labels) expect(overlap(l.box, marker), l.id).toBe(false);
    expect(overlap(labels[0].box, labels[1].box)).toBe(false);
  });

  it("stay on the map near its edge", () => {
    const [label] = placeLabels([request("Netherlands", [3, 100])], [], viewport);
    expect(label.box.x0).toBeGreaterThanOrEqual(0);
  });

  it("are left out where the label point is off the map", () => {
    expect(placeLabels([request("France", [-20, 100])], [], viewport)).toEqual([]);
  });

  it("give a small country narrower than its name a callout beside it, with a leader to its label point", () => {
    const [label] = placeLabels([request("Luxembourg", [150, 100], { small: true, width: 12 })], [], viewport);
    expect(label.callout).toEqual({ anchor: [150, 100] });
    expect(label.box.x1 - label.box.x0).toBeGreaterThan(textWidth("Luxembourg", 13));
    // Wide enough once zoomed in: named in place.
    const [zoomed] = placeLabels([request("Luxembourg", [150, 100], { small: true, width: 200 })], [], viewport);
    expect(zoomed.callout).toBeNull();
  });
});
