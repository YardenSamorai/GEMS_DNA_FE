/**
 * Issuer name -> the project's own letterhead assets: the emblem printed
 * beside the issuer's name, the tagline under it, and the accreditation
 * `marks` printed on every document the issuer sends.
 */
export const ISSUER_BRANDS = [
  {
    match: /^gemstar\b/i,
    logo: { src: "/gemstar-emblem.jpg", file: "public/gemstar-emblem.jpg", alt: "Gemstar", width: 281, height: 333 },
    tagline: ["Cutters and exporters of precious stones & diamonds", "Specializing in emeralds"],
    marks: [
      { src: "/rjc-certified-member.png", file: "public/rjc-certified-member.png", alt: "Responsible Jewellery Council, Certified Member 0000 4168" },
    ],
  },
];

const brandFor = (issuerName) => ISSUER_BRANDS.find((b) => b.match.test(issuerName || ""));

export const issuerLogo = (issuerName) => brandFor(issuerName)?.logo || null;

export const issuerTagline = (issuerName) => brandFor(issuerName)?.tagline || [];

export const issuerMarks = (issuerName) => brandFor(issuerName)?.marks || [];
