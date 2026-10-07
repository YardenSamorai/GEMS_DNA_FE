/*
 * The hero's story as a function of scroll progress through it (0..1).
 * Shared by the HTML chapters and the 3D scene so text and stone agree.
 *
 *   rough       the crystal as found
 *   cut         facets are placed one by one until the polished stone remains
 *   mapped      its edges and points are traced, a scan arc sweeps round it
 *   identified  its code assembles behind it and the record appears
 */

export const CHAPTERS = [
  { id: "rough", label: "Rough", from: 0, focus: 0 },
  { id: "cut", label: "Cut", from: 0.14, focus: 0.42 },
  { id: "mapped", label: "Mapped", from: 0.5, focus: 0.64 },
  { id: "identified", label: "Identified", from: 0.76, focus: 1 },
];

const ramp = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));

export function phases(p) {
  return {
    cut: ramp(p, 0.06, 0.42),
    map: ramp(p, 0.48, 0.72),
    id: ramp(p, 0.72, 0.97),
  };
}

export function chapterAt(p) {
  let index = 0;
  CHAPTERS.forEach((c, i) => {
    if (p >= c.from) index = i;
  });
  return index;
}

/* Stills of the stone at each chapter (public/home), for the poster before
 * the live scene, and for devices that don't get it. */
export const STILLS = {
  rough: { p: 0, alt: "A rough emerald crystal." },
  cut: { p: 0.46, alt: "The same crystal, cut into a polished emerald." },
  mapped: { p: 0.72, alt: "The polished emerald with its facet edges traced." },
  identified: { p: 1, alt: "The emerald in front of its QR code, with its identity ring complete." },
};
