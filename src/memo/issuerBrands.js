/**
 * Issuer name -> the project's own logo asset. `crop` is the artwork's box
 * inside the file's canvas (the SVG carries wide empty margins).
 */
export const ISSUER_BRANDS = [
  {
    match: /^gemstar\b/i,
    logo: { src: "/gemstarlogo.svg", file: "public/gemstarlogo.svg", alt: "Gemstar", width: 1751, height: 990, crop: [340, 192, 1070, 582] },
  },
];

export const issuerLogo = (issuerName) => ISSUER_BRANDS.find((b) => b.match.test(issuerName || ""))?.logo || null;
