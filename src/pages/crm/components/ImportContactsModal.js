import React, { useRef, useState, useMemo } from "react";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  importContactsPreview,
  importContactsExecute,
  fetchFolders,
} from "../../../services/crmApi";

const TARGET_FIELDS = [
  { key: "name", label: "Name *", required: true },
  { key: "title", label: "Title" },
  { key: "type", label: "Type" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone" },
  { key: "phoneAlt", label: "Alt phone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "address", label: "Address" },
  { key: "source", label: "Source" },
  { key: "notes", label: "Notes" },
  { key: "__skip__", label: "— Don't import —" },
];

// Smart guess for column auto-mapping
const COLUMN_HINTS = {
  name: ["name", "full name", "contact name", "first name", "fname"],
  title: ["title", "job title", "position", "role"],
  type: ["type", "category", "kind"],
  company: ["company", "organization", "organisation", "business", "firm"],
  phone: ["phone", "mobile", "cell", "tel", "telephone", "phone1"],
  phoneAlt: ["alt phone", "alternate phone", "office phone", "phone2", "phone 2", "secondary phone", "fax"],
  email: ["email", "e-mail", "mail"],
  website: ["website", "web", "url", "site"],
  country: ["country"],
  city: ["city", "town"],
  address: ["address", "street", "addr"],
  source: ["source", "origin", "lead source"],
  notes: ["notes", "note", "comments", "description", "remarks"],
};

const guessMapping = (headers) => {
  const map = {};
  for (const header of headers) {
    const norm = String(header || "").toLowerCase().trim();
    let matched = false;
    for (const [target, hints] of Object.entries(COLUMN_HINTS)) {
      if (hints.some((h) => norm === h || norm.includes(h))) {
        if (!Object.values(map).includes(target)) {
          map[header] = target;
          matched = true;
          break;
        }
      }
    }
    if (!matched) map[header] = "__skip__";
  }
  return map;
};

export default function ImportContactsModal({ onClose, onImported, defaultFolderId = null }) {
  const { user } = useUser();
  const fileRef = useRef(null);

  // Steps: 'upload' -> 'map' -> 'preview' -> 'done'
  const [step, setStep] = useState("upload");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]); // raw rows from file (array of objects keyed by header)
  const [mapping, setMapping] = useState({}); // header -> target field
  const [preview, setPreview] = useState(null); // server preview response
  const [actions, setActions] = useState({}); // rowIdx -> 'create'|'merge'|'skip'
  const [matchIds, setMatchIds] = useState({}); // rowIdx -> matchId
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(defaultFolderId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  React.useEffect(() => {
    if (user?.id) fetchFolders(user.id).then(setFolders).catch(() => {});
  }, [user?.id]);

  /* ------------- File parsing ------------- */
  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    setLoading(true);
    try {
      let parsedRows = [];
      let parsedHeaders = [];
      if (ext === "csv" || ext === "txt") {
        const text = await file.text();
        const r = Papa.parse(text, { header: true, skipEmptyLines: true });
        if (r.errors?.length > 0 && r.errors[0].type !== "Quotes") {
          console.warn("CSV warnings", r.errors);
        }
        parsedHeaders = r.meta.fields || [];
        parsedRows = r.data;
      } else if (ext === "json") {
        const text = await file.text();
        const json = JSON.parse(text);
        parsedRows = Array.isArray(json) ? json : (json.contacts || json.data || []);
        const allKeys = new Set();
        parsedRows.forEach((r) => Object.keys(r || {}).forEach((k) => allKeys.add(k)));
        parsedHeaders = Array.from(allKeys);
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        parsedHeaders = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];
      } else {
        toast.error("Unsupported file type. Use CSV, Excel or JSON.");
        return;
      }

      if (parsedRows.length === 0) {
        toast.error("File contains no rows");
        return;
      }
      setHeaders(parsedHeaders);
      setRows(parsedRows);
      setMapping(guessMapping(parsedHeaders));
      setStep("map");
    } catch (e) {
      toast.error(e.message || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  /* ------------- Mapping -> server preview ------------- */
  const mappedRows = useMemo(() => {
    if (rows.length === 0) return [];
    return rows.map((r) => {
      const out = {};
      for (const [header, target] of Object.entries(mapping)) {
        if (target && target !== "__skip__") {
          const val = r[header];
          if (val != null && String(val).trim() !== "") {
            out[target] = String(val).trim();
          }
        }
      }
      return out;
    }).filter(r => r.name); // need a name
  }, [rows, mapping]);

  const handleGoToPreview = async () => {
    if (mappedRows.length === 0) {
      toast.error("No rows mapped — make sure 'Name' is mapped to a column");
      return;
    }
    setLoading(true);
    try {
      const r = await importContactsPreview(user.id, mappedRows);
      setPreview(r);
      const a = {}, m = {};
      for (const p of r.preview) {
        a[p.rowIdx] = p.action;
        if (p.match) m[p.rowIdx] = p.match.id;
      }
      setActions(a);
      setMatchIds(m);
      setStep("preview");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ------------- Execute ------------- */
  const handleExecute = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const payload = preview.preview.map((p) => ({
        rowIdx: p.rowIdx,
        data: p.data,
        action: actions[p.rowIdx] || "skip",
        matchId: matchIds[p.rowIdx],
      }));
      const r = await importContactsExecute(user.id, payload, selectedFolder || null);
      setResult(r);
      setStep("done");
      onImported?.(r);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ------------- Render ------------- */
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white sm:rounded-2xl rounded-t-2xl w-full sm:max-w-3xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Import contacts</h3>
            <div className="text-xs text-stone-500 mt-0.5">
              {step === "upload" && "Step 1 of 3 · Choose a file"}
              {step === "map" && "Step 2 of 3 · Map columns to fields"}
              {step === "preview" && "Step 3 of 3 · Review and resolve duplicates"}
              {step === "done" && "Done"}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* UPLOAD */}
          {step === "upload" && (
            <div className="p-6 space-y-4">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-500 hover:bg-stone-50 text-center"
              >
                <div className="w-12 h-12 rounded-lg bg-stone-900 text-white flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
                </div>
                <div>
                  <div className="font-medium text-stone-900">Choose a file</div>
                  <div className="text-xs text-stone-500 mt-1">Supports CSV, Excel (.xlsx/.xls) or JSON</div>
                </div>
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt,.json,.xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
                <div className="font-semibold mb-1">Tips</div>
                <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                  <li>The first row should contain column headers (e.g. "Name", "Email", "Company")</li>
                  <li>You'll get to map columns to the correct fields in the next step</li>
                  <li>Duplicates are matched by phone or email — you can choose to merge or skip per row</li>
                </ul>
              </div>
            </div>
          )}

          {/* MAP */}
          {step === "map" && (
            <div className="p-5 space-y-4">
              <div className="text-sm text-stone-700">
                Found <strong>{rows.length}</strong> row{rows.length !== 1 ? "s" : ""} with <strong>{headers.length}</strong> column{headers.length !== 1 ? "s" : ""}.
                Map each column to a CRM field:
              </div>

              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                      <th className="text-left px-3 py-2 font-medium">Source column</th>
                      <th className="text-left px-3 py-2 font-medium">Sample</th>
                      <th className="text-left px-3 py-2 font-medium">Maps to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((h) => (
                      <tr key={h} className="border-t border-stone-100">
                        <td className="px-3 py-2 font-medium text-stone-800">{h}</td>
                        <td className="px-3 py-2 text-xs text-stone-500 truncate max-w-[200px]">
                          {String(rows[0]?.[h] || "—").slice(0, 60)}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={mapping[h] || "__skip__"}
                            onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                            className="w-full px-2 py-1 text-sm rounded border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
                          >
                            {TARGET_FIELDS.map((f) => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!Object.values(mapping).includes("name") && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  At least one column must be mapped to <strong>Name</strong>.
                </div>
              )}

              {folders.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-stone-600">Put new contacts in folder</label>
                  <select
                    value={selectedFolder || ""}
                    onChange={(e) => setSelectedFolder(e.target.value ? Number(e.target.value) : null)}
                    className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
                  >
                    <option value="">— Root (no folder) —</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* PREVIEW */}
          {step === "preview" && preview && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Total" value={preview.total} />
                <Stat label="New" value={preview.newCount} accent="text-emerald-600" />
                <Stat label="Duplicates" value={preview.duplicates} accent="text-amber-600" />
              </div>

              <div className="text-xs text-stone-600">
                For each row choose: <strong className="text-emerald-700">Create</strong> a new contact,
                <strong className="text-amber-700"> Merge</strong> into existing (only fills empty fields),
                or <strong className="text-stone-500">Skip</strong>.
              </div>

              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {preview.preview.map((p) => (
                  <PreviewRow
                    key={p.rowIdx}
                    item={p}
                    action={actions[p.rowIdx] || "create"}
                    onAction={(a) => setActions({ ...actions, [p.rowIdx]: a })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* DONE */}
          {step === "done" && result && (
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <div className="text-lg font-semibold text-stone-900">Import complete</div>
                <div className="mt-2 text-sm text-stone-600 space-y-1">
                  <div><strong className="text-emerald-600">{result.created}</strong> new contacts created</div>
                  <div><strong className="text-amber-600">{result.merged}</strong> merged into existing</div>
                  {result.skipped > 0 && <div><strong className="text-stone-500">{result.skipped}</strong> skipped</div>}
                  {result.failed > 0 && <div><strong className="text-rose-600">{result.failed}</strong> failed</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-between gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">
            {step === "done" ? "Close" : "Cancel"}
          </button>
          <div className="flex gap-2">
            {step === "map" && (
              <>
                <button onClick={() => setStep("upload")} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Back</button>
                <button
                  onClick={handleGoToPreview}
                  disabled={loading || !Object.values(mapping).includes("name")}
                  className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50"
                >
                  {loading ? "Checking…" : `Review ${mappedRows.length} rows`}
                </button>
              </>
            )}
            {step === "preview" && (
              <>
                <button onClick={() => setStep("map")} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Back</button>
                <button
                  onClick={handleExecute}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50"
                >
                  {loading ? "Importing…" : "Import"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const Stat = ({ label, value, accent }) => (
  <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 text-center">
    <div className={`text-2xl font-bold ${accent || "text-stone-900"}`}>{value}</div>
    <div className="text-[11px] uppercase tracking-wider text-stone-500 mt-1">{label}</div>
  </div>
);

const PreviewRow = ({ item, action, onAction }) => {
  const d = item.data;
  return (
    <div className={`rounded-lg border p-3 ${
      action === "create" ? "border-emerald-200 bg-emerald-50/30"
        : action === "merge" ? "border-amber-200 bg-amber-50/30"
        : "border-stone-200 bg-stone-50/40 opacity-60"
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-stone-900 text-sm truncate">{d.name}</div>
          <div className="text-xs text-stone-500 truncate">
            {[d.title, d.company, d.email, d.phone].filter(Boolean).join(" · ") || "No additional details"}
          </div>
          {item.match && (
            <div className="mt-1.5 text-[11px] text-amber-700 bg-amber-100 rounded px-2 py-1 inline-block">
              Matches existing: <strong>{item.match.name}</strong>
              {item.match.email && ` (${item.match.email})`}
            </div>
          )}
        </div>
        <div className="shrink-0 flex gap-1">
          <ActionBtn active={action === "create"} onClick={() => onAction("create")} color="emerald">Create</ActionBtn>
          {item.match && (
            <ActionBtn active={action === "merge"} onClick={() => onAction("merge")} color="amber">Merge</ActionBtn>
          )}
          <ActionBtn active={action === "skip"} onClick={() => onAction("skip")} color="stone">Skip</ActionBtn>
        </div>
      </div>
    </div>
  );
};

const ActionBtn = ({ active, onClick, children, color }) => {
  const colors = {
    emerald: active ? "bg-emerald-600 text-white" : "bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50",
    amber: active ? "bg-amber-600 text-white" : "bg-white text-amber-700 border border-amber-300 hover:bg-amber-50",
    stone: active ? "bg-stone-700 text-white" : "bg-white text-stone-600 border border-stone-300 hover:bg-stone-50",
  };
  return (
    <button onClick={onClick} className={`px-2 py-1 text-[11px] font-medium rounded ${colors[color]}`}>{children}</button>
  );
};
