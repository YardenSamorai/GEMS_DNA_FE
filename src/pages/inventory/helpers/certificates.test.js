import { certLabel, certificateFiles, grsCertName, planCertificates } from "./certificates";

const CERTS = "https://gems-dna-be.onrender.com/api/barak/Gemstones/Output/Certificates/";

const stone = (sku, lab, file) => ({ sku, lab, certificateUrl: file ? CERTS + file : null });

describe("certificate export plan", () => {
  it("names a certificate by lab and number, without repeating a lab already in the number", () => {
    expect(certLabel(stone("T-330F", "GRS", "2017-118049.pdf"))).toBe("GRS 2017-118049");
    expect(certLabel(stone("S1", "SIG", "SIG26050208.pdf"))).toBe("SIG26050208");
    expect(certLabel(stone("S2", "SSEF", "136490%2015.60.jpg"))).toBe("SSEF 136490 15.60");
    expect(certLabel(stone("S3", null, "Cert Sapphire.pdf"))).toBe("Cert Sapphire");
  });

  it("keeps selection order, downloads a shared pair certificate once, and lists stones without one", () => {
    const plan = planCertificates([
      stone("B1", "AGL", "1079036.pdf"),
      stone("A1", "GIA", null),
      stone("B2", "AGL", "1079036.pdf"),
      { sku: "R9", category: "Jewelry", certificateUrl: CERTS + "x.pdf" },
      stone("C1", "SSEF", "106735.jpg"),
    ]);
    expect(plan.certificates.map((c) => [c.skus, c.label, c.ext])).toEqual([
      [["B1", "B2"], "AGL 1079036", "pdf"],
      [["C1"], "SSEF 106735", "jpg"],
    ]);
    expect(plan.missing).toEqual(["A1"]);
    expect(plan.jewelry).toBe(1);
  });

  it("puts each GRS appendix right after its certificate", () => {
    const grs = stone("T1", "GRS", "2024-097019.pdf");
    expect(grsCertName(grs)).toBe("2024-097019");
    const { certificates } = planCertificates([grs, stone("T2", "GRS", "2017-128945.pdf"), stone("G1", "GIA", "2248074803.pdf")]);
    const files = certificateFiles(certificates, {
      "2024-097019": "https://app.barakdiamonds.com/Gemstones/Output/StoneImages/2024-097019-ap.pdf",
      "2017-128945": null,
    });
    expect(files.map((f) => f.name)).toEqual([
      "T1 - GRS 2024-097019.pdf",
      "T1 - GRS 2024-097019 appendix.pdf",
      "T2 - GRS 2017-128945.pdf",
      "G1 - GIA 2248074803.pdf",
    ]);
    expect(files[1].appendix).toBe(true);
  });

  it("names a shared certificate after both stones", () => {
    const { certificates } = planCertificates([stone("ME022", "SSEF", "106735.jpg"), stone("T8405", "SSEF", "106735.jpg")]);
    expect(certificateFiles(certificates).map((f) => f.name)).toEqual(["ME022 + T8405 - SSEF 106735.jpg"]);
  });
});
