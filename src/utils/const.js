import { mirrorSupplierUrl } from "./supplierMedia";

export const mapping = {
    "000": "Z",
    "00": "Y",
    "0": "I",
    "1": "H",
    "2": "A",
    "3": "R",
    "4": "E",
    "5": "L",
    "6": "O",
    "7": "V",
    "8": "S",
    "9": "K",
  };

/* Certificate numbers get appended to this to build a PDF URL. It points at
 * our own mirror because the supplier forbids browsers from displaying its
 * files on any other origin — see utils/supplierMedia.js. */
export const barakURL = mirrorSupplierUrl(
  "https://app.barakdiamonds.com/Gemstones/Output/Certificates"
);