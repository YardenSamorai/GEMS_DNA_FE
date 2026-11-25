import { contactError, itemSummary, leadPayload, readIdentity, splitName } from "./interestedModel";

const form = (over = {}) => ({
  interests: [],
  role: "",
  name: "",
  company: "",
  channel: "whatsapp",
  email: "",
  phone: "",
  note: "",
  hp: "",
  ...over,
});

test("splits a full name into first and last", () => {
  expect(splitName("  Dana  Levi Cohen ")).toEqual({ firstName: "Dana", lastName: "Levi Cohen" });
  expect(splitName("Dana")).toEqual({ firstName: "Dana", lastName: "" });
});

test("asks for the contact that matches the chosen channel", () => {
  expect(contactError("whatsapp", form())).toMatch(/number/);
  expect(contactError("call", form({ phone: "123" }))).toMatch(/short/);
  expect(contactError("whatsapp", form({ phone: "+972 54-123-4567" }))).toBeNull();
  expect(contactError("email", form({ phone: "+972541234567" }))).toMatch(/email/);
  expect(contactError("email", form({ email: "dana@" }))).toMatch(/complete/);
  expect(contactError("email", form({ email: "dana@shop.com" }))).toBeNull();
});

test("builds the CRM payload with the choices folded into the message", () => {
  const p = leadPayload({
    form: form({
      name: "Dana Levi",
      interests: ["price", "hold"],
      role: "designer",
      channel: "email",
      email: " dana@shop.com ",
      note: "Need it by June",
      hp: "",
    }),
    sku: "E123",
    snapshot: { sku: "E123", weightCt: 2 },
  });
  expect(p).toMatchObject({
    firstName: "Dana",
    lastName: "Levi",
    email: "dana@shop.com",
    title: "Designer",
    sku: "E123",
    message: "Need it by June\nInterested in: Price & availability, Hold it for me\nReply by: Email",
  });
  expect(p.snapshot).toMatchObject({ sku: "E123", interests: ["price", "hold"], preferredChannel: "email", role: "designer" });
});

test("reads identities cached by the old form", () => {
  expect(readIdentity({ firstName: "Dana", lastName: "Levi", email: "d@x.co", title: "Buyer" })).toMatchObject({
    name: "Dana Levi",
    email: "d@x.co",
    role: "",
    channel: "",
  });
  expect(readIdentity(null)).toBeNull();
});

test("describes pairs, sets and jewelry in their own words", () => {
  expect(itemSummary({ isPair: true, weightCt: 4.1, shape: "Oval" })).toMatchObject({ noun: "pair", title: "Matched pair" });
  expect(itemSummary({ isSet: true, stones: [{}, {}, {}], weightCt: 6 })).toMatchObject({
    noun: "set",
    title: "Set of 3 stones",
    subtitle: "6.00 ct total",
  });
  expect(itemSummary({ category: "Jewelry", jewelryType: "Ring", stoneType: "Emerald" })).toMatchObject({
    noun: "piece",
    title: "Ring",
    subtitle: "Emerald",
  });
  expect(itemSummary({ weightCt: 2.5, shape: "Oval", category: "Emerald" }).title).toMatch(/^2\.50 ct/);
});
