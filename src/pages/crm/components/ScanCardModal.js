import React, { useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  scanBusinessCard,
  createContact,
  updateContact,
  verifyBusiness,
  CONTACT_TYPES,
} from "../../../services/crmApi";

const downscaleImage = (file, maxSide = 1600, quality = 0.85) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });

const fillIfEmpty = (existing, incoming) => {
  if (!incoming) return existing;
  if (existing == null || existing === "") return incoming;
  return existing;
};

const initialFormFromExtracted = (data) => ({
  name: data?.name || "",
  type: data?.type || "lead",
  title: data?.title || data?.jobTitle || "",
  company: data?.company || "",
  phone: data?.phone || "",
  phoneAlt: data?.phoneAlt || "",
  email: data?.email || "",
  website: data?.website || "",
  country: data?.country || "",
  city: data?.city || "",
  address: data?.address || "",
  notes: data?.notes || "",
  source: "Business card",
});

export default function ScanCardModal({ onClose, onSaved }) {
  const { user } = useUser();
  const fileFrontRef = useRef(null);
  const cameraFrontRef = useRef(null);
  const fileBackRef = useRef(null);
  const cameraBackRef = useRef(null);

  // Steps: 'capture-front' -> 'preview-front' -> 'capture-back' (optional) -> 'preview-both' -> 'review'
  const [step, setStep] = useState("capture-front");
  const [imageFront, setImageFront] = useState(null);
  const [imageBack, setImageBack] = useState(null);
  const [scanning, setScanning] = useState(false);

  // After scan: array of editable forms (1 or 2 entries) + the scan response metadata
  const [forms, setForms] = useState([]);
  const [activeFormIdx, setActiveFormIdx] = useState(0);
  const [matchesPerForm, setMatchesPerForm] = useState([]);
  const [isTwoPeople, setIsTwoPeople] = useState(false);
  const [twoPeopleReason, setTwoPeopleReason] = useState(null);
  const [twoPeopleDecision, setTwoPeopleDecision] = useState(null); // null | 'split' | 'merge'

  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState(null);
  const [saving, setSaving] = useState(false);

  /* ---------------- Image capture ---------------- */
  const handleFile = async (file, side) => {
    if (!file) return;
    try {
      const dataUrl = await downscaleImage(file);
      if (side === "front") {
        setImageFront(dataUrl);
        setStep("preview-front");
      } else {
        setImageBack(dataUrl);
        setStep("preview-both");
      }
    } catch (e) {
      toast.error("Failed to load image");
    }
  };

  /* ---------------- Scan ---------------- */
  const handleScan = async () => {
    if (!imageFront) return;
    setScanning(true);
    try {
      const res = await scanBusinessCard(user.id, imageFront, imageBack || null);
      // Backend returns { contacts: [{ extracted, matches }], isTwoPeople, reason }
      let entries = res.contacts || [];
      if (entries.length === 0 && res.extracted) {
        entries = [{ extracted: res.extracted, matches: res.matches || [] }];
      }
      if (entries.length === 0) {
        toast.error("Could not read any contact details from the card");
        return;
      }
      setForms(entries.map((e) => initialFormFromExtracted(e.extracted)));
      setMatchesPerForm(entries.map((e) => e.matches || []));
      setIsTwoPeople(!!res.isTwoPeople && entries.length > 1);
      setTwoPeopleReason(res.reason || null);
      setTwoPeopleDecision(null);
      setActiveFormIdx(0);
      setStep("review");
    } catch (e) {
      toast.error(e.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleRetakeFront = () => { setImageFront(null); setStep("capture-front"); };
  const handleRetakeBack = () => { setImageBack(null); setStep("capture-back"); };
  const handleStartOver = () => {
    setImageFront(null); setImageBack(null);
    setForms([]); setMatchesPerForm([]);
    setIsTwoPeople(false); setTwoPeopleReason(null); setTwoPeopleDecision(null);
    setVerification(null);
    setStep("capture-front");
  };

  /* ---------------- Two-people decision ---------------- */
  const mergeTwoForms = () => {
    if (forms.length < 2) return;
    const [a, b] = forms;
    const merged = {
      ...a,
      title: a.title || b.title || "",
      company: a.company || b.company || "",
      phoneAlt: a.phoneAlt || b.phone || b.phoneAlt || "",
      email: a.email || b.email || "",
      website: a.website || b.website || "",
      country: a.country || b.country || "",
      city: a.city || b.city || "",
      address: a.address || b.address || "",
      notes: [a.notes, b.notes ? `[Back side] ${b.notes}` : null].filter(Boolean).join("\n"),
    };
    setForms([merged]);
    setActiveFormIdx(0);
    setTwoPeopleDecision("merge");
  };

  /* ---------------- Verify online ---------------- */
  const handleVerifyOnline = async () => {
    const f = forms[activeFormIdx];
    if (!f) return;
    setVerifying(true);
    setVerification(null);
    try {
      const r = await verifyBusiness({
        name: f.name, company: f.company, email: f.email, phone: f.phone,
        country: f.country, city: f.city, website: f.website,
      });
      setVerification(r);
      const df = r?.discoveredFields || {};
      const patch = {};
      ["company", "phone", "email", "website", "country", "city", "address"].forEach((k) => {
        if (df[k] && !f[k]) patch[k] = df[k];
      });
      const extras = ["linkedin", "instagram", "industry", "yearsActive"]
        .filter((k) => df[k]).map((k) => `${k}: ${df[k]}`);
      if (extras.length || df.notes) {
        const verifiedNote = `\n\n--- Verified online ${new Date().toLocaleDateString()} ---\n${extras.join("\n")}${df.notes ? "\n" + df.notes : ""}`.trim();
        patch.notes = (f.notes ? f.notes + "\n\n" : "") + verifiedNote;
      }
      if (Object.keys(patch).length > 0) {
        setForms((arr) => arr.map((x, i) => i === activeFormIdx ? { ...x, ...patch } : x));
        toast.success("Filled in missing details from web");
      }
    } catch (e) {
      toast.error(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  /* ---------------- Save ---------------- */
  const handleSaveAll = async () => {
    const formsToSave = isTwoPeople && twoPeopleDecision !== "merge" ? forms : [forms[0]];
    for (const f of formsToSave) {
      if (!f.name?.trim()) {
        toast.error("Each contact needs a name");
        return;
      }
    }
    setSaving(true);
    try {
      const created = [];
      for (const f of formsToSave) {
        const res = await createContact({ userId: user.id, ...f });
        created.push(res);
      }
      // If two people saved, link them via linked_contact_ids
      if (created.length === 2) {
        try {
          await updateContact(created[0].id, { linkedContactIds: [created[1].id] });
          await updateContact(created[1].id, { linkedContactIds: [created[0].id] });
        } catch (_) {}
      }
      toast.success(created.length === 2 ? "Saved 2 linked contacts" : "Contact added");
      onSaved?.(created[0]);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMergeIntoExisting = async (existing) => {
    const f = forms[activeFormIdx];
    if (!f) return;
    setSaving(true);
    try {
      const merged = {
        name: fillIfEmpty(existing.name, f.name),
        type: fillIfEmpty(existing.type, f.type),
        title: fillIfEmpty(existing.title, f.title),
        company: fillIfEmpty(existing.company, f.company),
        phone: fillIfEmpty(existing.phone, f.phone),
        phoneAlt: fillIfEmpty(existing.phone_alt, f.phoneAlt),
        email: fillIfEmpty(existing.email, f.email),
        website: fillIfEmpty(existing.website, f.website),
        country: fillIfEmpty(existing.country, f.country),
        city: fillIfEmpty(existing.city, f.city),
        address: fillIfEmpty(existing.address, f.address),
        notes: existing.notes
          ? `${existing.notes}\n\n--- From scan ${new Date().toLocaleDateString()} ---\n${f.notes || ""}`.trim()
          : f.notes,
      };
      const updated = await updateContact(existing.id, merged);
      toast.success(`Merged into ${existing.name}`);
      onSaved?.(updated);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- Render ---------------- */
  const stepLabel = {
    "capture-front": "Step 1 of 2 · Front of card",
    "preview-front": "Step 1 of 2 · Front of card",
    "capture-back": "Step 2 of 2 · Back of card (optional)",
    "preview-both": "Both sides ready",
    "review": "Review",
  }[step];

  const updateForm = (idx, patch) =>
    setForms((arr) => arr.map((x, i) => i === idx ? { ...x, ...patch } : x));

  const activeForm = forms[activeFormIdx] || null;
  const activeMatches = matchesPerForm[activeFormIdx] || [];

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg shadow-2xl max-h-[95vh] sm:max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Scan business card</h3>
            <div className="text-xs text-stone-500 mt-0.5">{stepLabel}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* CAPTURE FRONT */}
          {step === "capture-front" && (
            <CaptureStep
              title="Take or upload the FRONT side"
              subtitle="The side with the person's name and main details"
              cameraRef={cameraFrontRef}
              fileRef={fileFrontRef}
              onFile={(f) => handleFile(f, "front")}
            />
          )}

          {/* PREVIEW FRONT */}
          {step === "preview-front" && imageFront && (
            <div className="p-5 space-y-4">
              <ImageCard image={imageFront} label="FRONT" />
              <div className="rounded-xl border border-stone-200 p-3 bg-stone-50">
                <div className="text-sm font-medium text-stone-900">Does this card have a back side?</div>
                <div className="text-xs text-stone-600 mt-1">
                  Some cards have a partner / colleague on the back, or extra contact info. We'll merge or split automatically.
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={handleRetakeFront} className="px-3 py-2 text-sm text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg">Retake front</button>
                  <button onClick={() => setStep("capture-back")} className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add back side</button>
                </div>
                <button onClick={handleScan} disabled={scanning} className="mt-2 w-full px-3 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-60">
                  {scanning ? "Scanning…" : "Skip — scan front only"}
                </button>
              </div>
            </div>
          )}

          {/* CAPTURE BACK */}
          {step === "capture-back" && (
            <div>
              <CaptureStep
                title="Take or upload the BACK side"
                subtitle="If the back is blank or just a logo, you can skip"
                cameraRef={cameraBackRef}
                fileRef={fileBackRef}
                onFile={(f) => handleFile(f, "back")}
              />
              <div className="px-5 pb-5">
                <button onClick={() => setStep("preview-front")} className="w-full px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg">
                  Skip — back is empty / not needed
                </button>
              </div>
            </div>
          )}

          {/* PREVIEW BOTH */}
          {step === "preview-both" && imageFront && imageBack && (
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <ImageCard image={imageFront} label="FRONT" small onRetake={handleRetakeFront} />
                </div>
                <div>
                  <ImageCard image={imageBack} label="BACK" small onRetake={handleRetakeBack} />
                </div>
              </div>
              <div className="text-xs text-stone-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                The AI will check if both sides belong to the same person, or if it's two different contacts (e.g. partners). You'll be asked to confirm.
              </div>
              <button onClick={handleScan} disabled={scanning} className="w-full px-4 py-3 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {scanning ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    Reading both sides…
                  </>
                ) : "Scan both sides"}
              </button>
            </div>
          )}

          {/* REVIEW */}
          {step === "review" && activeForm && (
            <div className="p-5 space-y-4">
              {/* Two-people banner */}
              {isTwoPeople && twoPeopleDecision === null && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <div className="text-sm font-semibold text-purple-900">2 different people detected</div>
                  <div className="text-xs text-purple-700 mt-1">
                    {twoPeopleReason || "Front and back show different names / emails."}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => setTwoPeopleDecision("split")} className="px-3 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                      Save 2 separate
                    </button>
                    <button onClick={mergeTwoForms} className="px-3 py-2 text-sm font-medium bg-white border border-purple-300 text-purple-800 rounded-lg hover:bg-purple-50">
                      Merge into 1
                    </button>
                  </div>
                </div>
              )}

              {/* Tabs when 2 contacts to edit */}
              {isTwoPeople && twoPeopleDecision === "split" && forms.length === 2 && (
                <div className="flex gap-1 border-b border-stone-200">
                  {forms.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveFormIdx(i)}
                      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${activeFormIdx === i ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500"}`}
                    >
                      {i === 0 ? "Front" : "Back"} · {f.name || "Unnamed"}
                    </button>
                  ))}
                </div>
              )}

              {/* Match warning */}
              {activeMatches.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="text-sm font-semibold text-amber-900 mb-1">
                    Possible duplicate{activeMatches.length > 1 ? "s" : ""} found
                  </div>
                  <div className="text-xs text-amber-700 mb-3">
                    Matched by phone or email.
                  </div>
                  <div className="space-y-1.5">
                    {activeMatches.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleMergeIntoExisting(m)}
                        disabled={saving}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white border border-amber-200 hover:border-amber-400 text-left text-sm disabled:opacity-50"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-stone-900 truncate">{m.name}</div>
                          <div className="text-xs text-stone-500 truncate">
                            {[m.title, m.company, m.phone, m.email].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-stone-700 bg-stone-100 px-2 py-1 rounded shrink-0 ml-2">Merge into</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Image thumbnails */}
              <details className="text-xs">
                <summary className="cursor-pointer text-stone-500 hover:text-stone-800">View card image{imageBack ? "s" : ""}</summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {imageFront && <img src={imageFront} alt="Front" className="rounded-lg border border-stone-200" />}
                  {imageBack && <img src={imageBack} alt="Back" className="rounded-lg border border-stone-200" />}
                </div>
              </details>

              {/* Verify online */}
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-stone-900">Verify business online</div>
                    <div className="text-[11px] text-stone-600 mt-0.5">Cross-check the card against the public web and auto-fill what's missing.</div>
                  </div>
                </div>
                <button
                  onClick={handleVerifyOnline}
                  disabled={verifying || !activeForm.name?.trim()}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {verifying ? "Searching the web…" : (verification ? "Verify again" : "Verify online")}
                </button>
                {verification && (
                  <div className={`mt-3 rounded-lg p-2.5 text-xs ${verification.verified ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                    <div className="font-semibold">
                      {verification.verified ? "Verified" : "Could not fully verify"}
                      {verification.confidence && <span className="ml-1 opacity-70">· {verification.confidence}</span>}
                    </div>
                    {verification.summary && <div className="mt-0.5 opacity-90">{verification.summary}</div>}
                  </div>
                )}
              </div>

              {/* Editable form */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-stone-700 uppercase tracking-wider">Extracted details (editable)</div>
                <Input label="Name *" value={activeForm.name} onChange={(v) => updateForm(activeFormIdx, { name: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Title" value={activeForm.title} onChange={(v) => updateForm(activeFormIdx, { title: v })} placeholder="CEO, Designer..." />
                  <Select label="Type" value={activeForm.type} onChange={(v) => updateForm(activeFormIdx, { type: v })}
                    options={CONTACT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
                </div>
                <Input label="Company" value={activeForm.company} onChange={(v) => updateForm(activeFormIdx, { company: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Phone" value={activeForm.phone} onChange={(v) => updateForm(activeFormIdx, { phone: v })} />
                  <Input label="Alt phone" value={activeForm.phoneAlt} onChange={(v) => updateForm(activeFormIdx, { phoneAlt: v })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Email" value={activeForm.email} onChange={(v) => updateForm(activeFormIdx, { email: v })} />
                  <Input label="Website" value={activeForm.website} onChange={(v) => updateForm(activeFormIdx, { website: v })} placeholder="example.com" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Country" value={activeForm.country} onChange={(v) => updateForm(activeFormIdx, { country: v })} />
                  <Input label="City" value={activeForm.city} onChange={(v) => updateForm(activeFormIdx, { city: v })} />
                </div>
                <Input label="Address" value={activeForm.address} onChange={(v) => updateForm(activeFormIdx, { address: v })} />
                <Textarea label="Notes" value={activeForm.notes} onChange={(v) => updateForm(activeFormIdx, { notes: v })} />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step === "review" && (
          <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-between gap-2">
            <button onClick={handleStartOver} className="px-3 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Start over</button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Cancel</button>
              <button
                onClick={handleSaveAll}
                disabled={saving || !forms.every(f => f.name?.trim()) || (isTwoPeople && twoPeopleDecision === null)}
                className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : (isTwoPeople && twoPeopleDecision === "split"
                      ? "Save 2 contacts"
                      : "Save contact")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- helpers / sub-components ---------------- */

const CaptureStep = ({ title, subtitle, cameraRef, fileRef, onFile }) => (
  <div className="p-6 space-y-3">
    {title && <div className="text-sm font-semibold text-stone-900">{title}</div>}
    {subtitle && <div className="text-xs text-stone-500">{subtitle}</div>}
    <button
      onClick={() => cameraRef.current?.click()}
      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-500 hover:bg-stone-50 text-left"
    >
      <div className="w-12 h-12 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </div>
      <div>
        <div className="font-medium text-stone-900">Take photo</div>
        <div className="text-xs text-stone-500">Use the back camera</div>
      </div>
    </button>
    <button
      onClick={() => fileRef.current?.click()}
      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-500 hover:bg-stone-50 text-left"
    >
      <div className="w-12 h-12 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      </div>
      <div>
        <div className="font-medium text-stone-900">Upload from gallery</div>
        <div className="text-xs text-stone-500">Pick an existing photo</div>
      </div>
    </button>

    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
  </div>
);

const ImageCard = ({ image, label, small, onRetake }) => (
  <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
    <img src={image} alt={label} className={`w-full object-contain ${small ? "max-h-40" : "max-h-80"}`} />
    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-stone-900/80 text-white text-[10px] font-semibold tracking-wider">{label}</div>
    {onRetake && (
      <button onClick={onRetake} className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-white/90 text-stone-700 text-[11px] font-medium shadow hover:bg-white">
        Retake
      </button>
    )}
  </div>
);

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400";

const Input = ({ label, value, onChange, placeholder }) => (
  <label className="block">
    <div className="text-xs font-medium text-stone-600 mb-1">{label}</div>
    <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={placeholder} />
  </label>
);
const Textarea = ({ label, value, onChange }) => (
  <label className="block">
    <div className="text-xs font-medium text-stone-600 mb-1">{label}</div>
    <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${inputCls} min-h-[70px]`} />
  </label>
);
const Select = ({ label, value, onChange, options }) => (
  <label className="block">
    <div className="text-xs font-medium text-stone-600 mb-1">{label}</div>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
);
