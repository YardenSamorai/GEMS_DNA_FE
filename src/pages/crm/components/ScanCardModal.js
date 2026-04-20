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

// downscale to <= maxWidth/Height to keep payload small while preserving readability
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

export default function ScanCardModal({ onClose, onSaved }) {
  const { user } = useUser();
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const [step, setStep] = useState("capture");
  const [imageData, setImageData] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState(null);
  const [mergeMode, setMergeMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await downscaleImage(file);
      setImageData(dataUrl);
      setStep("preview");
    } catch (e) {
      toast.error("Failed to load image");
    }
  };

  const handleScan = async () => {
    if (!imageData) return;
    setScanning(true);
    try {
      const { extracted: data, matches: m } = await scanBusinessCard(user.id, imageData);
      setExtracted(data);
      setMatches(m || []);
      setForm({
        name: data.name || "",
        type: data.type || "lead",
        company: data.company || "",
        phone: data.phone || "",
        email: data.email || "",
        country: data.country || "",
        city: data.city || "",
        address: data.address || "",
        notes: [
          data.jobTitle ? `Title: ${data.jobTitle}` : null,
          data.website ? `Website: ${data.website}` : null,
          data.phoneAlt ? `Alt phone: ${data.phoneAlt}` : null,
          data.notes || null,
        ].filter(Boolean).join("\n"),
        source: "Business card",
      });
      if (m && m.length > 0) {
        setMergeMode("ask");
      }
      setStep("review");
    } catch (e) {
      toast.error(e.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleRescan = () => {
    setImageData(null);
    setExtracted(null);
    setMatches([]);
    setForm(null);
    setMergeMode(null);
    setVerification(null);
    setStep("capture");
  };

  const handleVerifyOnline = async () => {
    if (!form) return;
    setVerifying(true);
    setVerification(null);
    try {
      const r = await verifyBusiness({
        name: form.name,
        company: form.company,
        email: form.email,
        phone: form.phone,
        country: form.country,
        city: form.city,
      });
      setVerification(r);

      // Auto-fill empty fields from the discovered data
      const df = r?.discoveredFields || {};
      const patch = {};
      ["company", "phone", "email", "country", "city", "address"].forEach((k) => {
        if (df[k] && !form[k]) patch[k] = df[k];
      });
      const extras = ["website", "linkedin", "instagram", "industry", "yearsActive"]
        .filter((k) => df[k])
        .map((k) => `${k}: ${df[k]}`);
      if (extras.length || df.notes) {
        const verifiedNote = `\n\n--- Verified online ${new Date().toLocaleDateString()} ---\n${extras.join("\n")}${df.notes ? "\n" + df.notes : ""}`.trim();
        patch.notes = (form.notes ? form.notes + "\n\n" : "") + verifiedNote;
      }
      if (Object.keys(patch).length > 0) {
        setForm((f) => ({ ...f, ...patch }));
        toast.success("Filled in missing details from web");
      }
    } catch (e) {
      toast.error(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveNew = async () => {
    if (!form?.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const created = await createContact({ userId: user.id, ...form });
      toast.success("Contact added");
      onSaved?.(created);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMergeInto = async (existing) => {
    setSaving(true);
    try {
      const merged = {
        name: fillIfEmpty(existing.name, form.name),
        type: fillIfEmpty(existing.type, form.type),
        company: fillIfEmpty(existing.company, form.company),
        phone: fillIfEmpty(existing.phone, form.phone),
        email: fillIfEmpty(existing.email, form.email),
        country: fillIfEmpty(existing.country, form.country),
        city: fillIfEmpty(existing.city, form.city),
        address: fillIfEmpty(existing.address, form.address),
        notes: existing.notes
          ? `${existing.notes}\n\n--- From scan ${new Date().toLocaleDateString()} ---\n${form.notes || ""}`.trim()
          : form.notes,
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white sm:rounded-2xl rounded-t-2xl w-full sm:max-w-lg shadow-2xl max-h-[95vh] sm:max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Scan business card</h3>
            <div className="text-xs text-stone-500 mt-0.5">
              {step === "capture" && "Take a photo or upload a card"}
              {step === "preview" && "Confirm or retake"}
              {step === "review" && "Review extracted details"}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === "capture" && (
            <div className="p-6 space-y-3">
              <button
                onClick={() => cameraRef.current?.click()}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-500 hover:bg-stone-50 text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div>
                  <div className="font-medium text-stone-900">Take photo</div>
                  <div className="text-xs text-stone-500">Use the back camera (recommended at shows)</div>
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

              <input
                ref={cameraRef}
                type="file" accept="image/*" capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <input
                ref={fileRef}
                type="file" accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          )}

          {step === "preview" && imageData && (
            <div className="p-5 space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
                <img src={imageData} alt="Card" className="w-full max-h-80 object-contain" />
                {scanning && (
                  <>
                    {/* Subtle dark overlay */}
                    <div className="absolute inset-0 bg-stone-900/20 pointer-events-none" />
                    {/* Corner brackets */}
                    <div className="absolute inset-3 pointer-events-none">
                      <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
                      <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
                      <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
                      <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br" />
                    </div>
                    {/* Scan line + glow that sweeps left to right */}
                    <div className="scan-sweep absolute top-0 bottom-0 pointer-events-none" />
                    {/* Status pill */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/85 text-white text-xs font-medium shadow-lg backdrop-blur-sm pointer-events-none">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      Reading card…
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleRescan} disabled={scanning} className="flex-1 px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg disabled:opacity-50">
                  Retake
                </button>
                <button onClick={handleScan} disabled={scanning} className="flex-1 px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50">
                  {scanning ? "Scanning…" : "Scan card"}
                </button>
              </div>
              <style>{`
                @keyframes scanSweep {
                  0%   { transform: translateX(-20%); opacity: 0; }
                  10%  { opacity: 1; }
                  90%  { opacity: 1; }
                  100% { transform: translateX(420%); opacity: 0; }
                }
                .scan-sweep {
                  width: 18%;
                  left: 0;
                  background: linear-gradient(
                    to right,
                    rgba(16, 185, 129, 0)    0%,
                    rgba(16, 185, 129, 0.15) 35%,
                    rgba(16, 185, 129, 0.95) 50%,
                    rgba(16, 185, 129, 0.15) 65%,
                    rgba(16, 185, 129, 0)    100%
                  );
                  box-shadow: 0 0 24px 6px rgba(16, 185, 129, 0.55);
                  animation: scanSweep 1.6s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
                  mix-blend-mode: screen;
                }
              `}</style>
            </div>
          )}

          {step === "review" && form && (
            <div className="p-5 space-y-4">
              {/* Match warning */}
              {matches.length > 0 && mergeMode === "ask" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="text-sm font-semibold text-amber-900 mb-1">
                    Possible duplicate{matches.length > 1 ? "s" : ""} found
                  </div>
                  <div className="text-xs text-amber-700 mb-3">
                    Matched by phone or email. Pick to merge, or save as new.
                  </div>
                  <div className="space-y-1.5">
                    {matches.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleMergeInto(m)}
                        disabled={saving}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white border border-amber-200 hover:border-amber-400 text-left text-sm disabled:opacity-50"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-stone-900 truncate">{m.name}</div>
                          <div className="text-xs text-stone-500 truncate">
                            {[m.company, m.phone, m.email].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-stone-700 bg-stone-100 px-2 py-1 rounded shrink-0 ml-2">Merge</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setMergeMode("new")}
                    className="mt-3 text-xs font-medium text-stone-600 hover:text-stone-900"
                  >
                    No, save as new contact →
                  </button>
                </div>
              )}

              {/* Image thumbnail */}
              {imageData && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-stone-500 hover:text-stone-800">View card image</summary>
                  <img src={imageData} alt="Card" className="mt-2 max-h-40 rounded-lg border border-stone-200" />
                </details>
              )}

              {/* Verify online */}
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-stone-900">Verify business online</div>
                    <div className="text-[11px] text-stone-600 mt-0.5">
                      Cross-check the card against the public web (LinkedIn, official site, trade directories) and auto-fill anything that's missing.
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleVerifyOnline}
                  disabled={verifying || !form.name?.trim()}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {verifying ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                      Searching the web…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      {verification ? "Verify again" : "Verify online"}
                    </>
                  )}
                </button>
                {verification && (
                  <div className={`mt-3 rounded-lg p-2.5 text-xs ${verification.verified ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                    <div className="font-semibold">
                      {verification.verified ? "Verified" : "Could not fully verify"}
                      {verification.confidence && <span className="ml-1 opacity-70">· {verification.confidence}</span>}
                    </div>
                    {verification.summary && <div className="mt-0.5 opacity-90">{verification.summary}</div>}
                    {verification.sources && verification.sources.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                        {verification.sources.map((s, i) => (
                          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="underline opacity-80 hover:opacity-100">
                            {s.label || "source"}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Editable form */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-stone-700 uppercase tracking-wider">Extracted details (editable)</div>
                <Input label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })}
                    options={CONTACT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
                  <Input label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
                  <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                </div>
                <Input label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
                <Textarea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step === "review" && (
          <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-between gap-2">
            <button onClick={handleRescan} className="px-3 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Retake</button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Cancel</button>
              <button
                onClick={handleSaveNew}
                disabled={saving || !form.name?.trim()}
                className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : (matches.length > 0 ? "Save as new" : "Save contact")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400";

const Input = ({ label, value, onChange }) => (
  <label className="block">
    <div className="text-xs font-medium text-stone-600 mb-1">{label}</div>
    <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />
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
