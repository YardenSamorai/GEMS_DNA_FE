import { itemsParam, mediaFor, parseItemsParam, pickItems, specsFor } from "./presentModel";

const stone = {
  id: 7,
  sku: "T-432E",
  category: "Emerald",
  shape: "Heart",
  weightCt: 8.58,
  treatment: "Minor",
  origin: "Colombia",
  lab: "GRS",
  box: "B-12",
  location: "Israel",
  imageUrl: "https://example.com/T-432E_Main.jpg",
  additionalPictures: "https://example.com/T-432E_2.jpg;https://example.com/T-432E_Main.jpg;https://example.com/Folder/",
  videoUrl: "https://player.vimeo.com/video/1220478132",
  additionalVideos: "https://v360.in/gemstone/vision360.html?d=T-432E",
  certificateUrl: "https://example.com/cert.pdf",
  certificateImageJpg: "https://example.com/cert.jpg",
};
const ring = { id: "jwl_0_RG-1", sku: "RG-1", category: "Jewelry", jewelryType: "Ring", metalType: "18K", allImages: ["https://example.com/rg.jpg"] };

test("items survive the URL by SKU, jewelry prefixed, order kept", () => {
  const param = itemsParam([ring, stone]);
  expect(param).toBe("j:RG-1,T-432E");
  expect(parseItemsParam(param)).toEqual([
    { kind: "jewelry", sku: "RG-1" },
    { kind: "stone", sku: "T-432E" },
  ]);
  expect(pickItems(parseItemsParam(`${param},GONE`), [stone], [ring])).toEqual([ring, stone]);
});

test("media: photos deduped and folder paths dropped, then video and 360°, then the certificate image", () => {
  expect(mediaFor(stone).map((m) => [m.type, m.label || "", m.src])).toEqual([
    ["image", "", "https://example.com/T-432E_Main.jpg"],
    ["image", "", "https://example.com/T-432E_2.jpg"],
    ["video", "Video 1", "https://player.vimeo.com/video/1220478132"],
    ["video", "360°", "https://v360.in/gemstone/vision360.html?d=T-432E"],
    ["cert", "", "https://example.com/cert.jpg"],
  ]);
  expect(mediaFor(stone).at(-1).link).toBe("https://example.com/cert.pdf");
});

test("specs are client-facing: no box or location", () => {
  const labels = specsFor(stone).map(([k]) => k);
  expect(labels).toEqual(expect.arrayContaining(["Shape", "Weight", "Treatment", "Origin", "Lab"]));
  expect(labels).not.toContain("Box");
  expect(labels).not.toContain("Location");
  expect(specsFor(ring)).toEqual([["Type", "Ring"], ["Metal", "18K"]]);
});
