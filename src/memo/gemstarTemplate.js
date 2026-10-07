/**
 * Gemstar's fixed memo content, copied verbatim from Barak's "Memo 2024"
 * template (issuer block, consignment terms, conflict statement, bank
 * details, footer). Memos created in Gems DNA print exactly this text; edit
 * here when Gemstar changes its template. Spelling is the template's own.
 */
export const GEMSTAR_MEMO_TEMPLATE = Object.freeze({
  issuer: {
    name: "Gemstar Ltd.",
    addressLines: ["Diamond Tower, 32nd Floor, Suite #3270", "5252138, Ramat Gan, Israel"],
    phone: "+972.3.575.1137",
    fax: "+972.3.575.1475",
    email: "info@gems.net",
    website: "www.eshed.com",
    courier: null,
  },
  terms: [
    "The goods described and valued as below are delivered to you for EXAMINATION AND INSPECTION ONLY, and remain our property and shall be returned to us on demand and in any event, such merchandise, until returned to us and actually received by us, is at your risk from all hazards. No right or power is given to you to sell, pledge, hypothecate or otherwise dispose of this merchandise regardless of prior transactions. A sale of this merchandise can only be effected and title will pass only if, as and when we the said owners shall agree to such sale in writing and shall have billed you for the merchandise. All moneys received by you on the sale of the merchandise shall be held in trust for us, until the full amount invoiced has been paid to us. The undersigned personally guarantee the below obligations on behalf of the company .",
    "“The GEMSTONES herein invoiced have been purchased from legitimate sources not involved in funding conflict and in compliance with United Nations resolutions. The seller hereby guarantees that these Gemsotnes are conflict free and confirms adherence to the WDC SoW Guidelines.”",
  ],
  bank: [
    { label: "Account Number", lines: ["90801-910025"] },
    { label: "Bank Name", lines: ["Israel Discount Bank Ltd"] },
    { label: "Banker's Address", lines: ["Diamond Exchange Branch", "Ramat Gan Israel"] },
    { label: "IBAN", lines: ["IL 270 110 80000000 1910029"] },
    { label: "Swift Code", lines: ["IDBLILITXXX"] },
  ],
  signature: "Customer Signature",
  footer: ["Gemstar Ltd.", "510997646"],
});
