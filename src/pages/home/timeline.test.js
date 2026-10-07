import { CHAPTERS, chapterAt, phases } from "./timeline";

describe("hero timeline", () => {
  it("starts rough and ends identified", () => {
    expect(phases(0)).toEqual({ cut: 0, map: 0, id: 0 });
    expect(phases(1)).toEqual({ cut: 1, map: 1, id: 1 });
    expect(chapterAt(0)).toBe(0);
    expect(chapterAt(1)).toBe(CHAPTERS.length - 1);
  });

  it("finishes the cut before the mapping begins", () => {
    expect(phases(0.48).cut).toBeGreaterThan(0.94);
    expect(phases(0.48).map).toBe(0);
  });

  it("shows each chapter at its own focus point", () => {
    CHAPTERS.forEach((c, i) => expect(chapterAt(c.focus)).toBe(i));
  });
});
