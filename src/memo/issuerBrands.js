/**
 * Issuer name -> the project's own logo asset. `crop` is the artwork's box
 * inside the file's canvas (the SVG carries wide empty margins). `marks` are
 * accreditations printed on every document the issuer sends.
 */
export const ISSUER_BRANDS = [
  {
    match: /^gemstar\b/i,
    logo: { src: "/gemstarlogo.svg", file: "public/gemstarlogo.svg", alt: "Gemstar", width: 1751, height: 990, crop: [340, 192, 1070, 582] },
    marks: [
      { src: "/rjc-certified-member.png", file: "public/rjc-certified-member.png", alt: "Responsible Jewellery Council, Certified Member 0000 4168" },
    ],
  },
];

const brandFor = (issuerName) => ISSUER_BRANDS.find((b) => b.match.test(issuerName || ""));

export const issuerLogo = (issuerName) => brandFor(issuerName)?.logo || null;

export const issuerMarks = (issuerName) => brandFor(issuerName)?.marks || [];
