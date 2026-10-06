// Debug: print the extracted runs of a Barak PDF, or the parsed record (--parsed).
import "./register.mjs";
import { extractPdf } from "./extract.mjs";

const file = process.argv[2];
const doc = await extractPdf(file);

if (process.argv.includes("--parsed")) {
  const { parseBarakMemo } = await import("../../src/memo/barak/parseBarakMemo.js");
  console.log(JSON.stringify(parseBarakMemo(doc), null, 2));
} else {
  console.log(JSON.stringify({ producer: doc.producer, title: doc.title, created: doc.created }));
  for (const p of doc.pages) {
    console.log(`=== page ${p.number} ${Math.round(p.width)}x${Math.round(p.height)}`);
    p.images.forEach((im) => console.log("IMG", Math.round(im.x0), Math.round(im.y0), Math.round(im.x1), Math.round(im.y1)));
    p.runs.forEach((r) =>
      console.log(String(Math.round(r.x0)).padStart(4), String(Math.round(r.y0)).padStart(4), String(Math.round(r.x1)).padStart(4), `s${r.size.toFixed(1)}`, JSON.stringify(r.text)),
    );
  }
}
