import React, { useState, useMemo } from "react";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { sendEmailBroadcast } from "../../../services/crmApi";

/**
 * Broadcast email to selected contacts.
 * Props:
 *   recipients: array of contacts { id, name, email, company, title }
 *   onClose
 *   onSent
 */
export default function BroadcastEmailModal({ recipients = [], onClose, onSent }) {
  const { user } = useUser();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromName, setFromName] = useState(user?.fullName || "GEMS DNA");
  const [replyTo, setReplyTo] = useState(user?.primaryEmailAddress?.emailAddress || "");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  const eligible = useMemo(() => recipients.filter((r) => r.email), [recipients]);
  const skipped = recipients.length - eligible.length;

  const personalize = (template, c) => {
    if (!template) return "";
    const firstName = (c.name || "").split(/\s+/)[0] || "";
    return template
      .replace(/\{\{?\s*name\s*\}?\}/gi, c.name || "")
      .replace(/\{\{?\s*firstName\s*\}?\}/gi, firstName)
      .replace(/\{\{?\s*company\s*\}?\}/gi, c.company || "")
      .replace(/\{\{?\s*title\s*\}?\}/gi, c.title || "");
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    if (eligible.length === 0) {
      toast.error("No recipients have an email address");
      return;
    }
    if (!window.confirm(`Send to ${eligible.length} recipient${eligible.length > 1 ? "s" : ""}?`)) return;

    setSending(true);
    try {
      const r = await sendEmailBroadcast({
        userId: user.id,
        contactIds: eligible.map((c) => c.id),
        subject,
        text: body,
        html: body.replace(/\n/g, "<br>"),
        fromName,
        replyTo: replyTo || undefined,
      });
      setResult(r);
      toast.success(`Sent ${r.sent} of ${r.total}`);
      onSent?.(r);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const previewContact = eligible[previewIdx] || { name: "Sample", company: "Acme", title: "CEO" };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white sm:rounded-2xl rounded-t-2xl w-full sm:max-w-2xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Email broadcast</h3>
            <div className="text-xs text-stone-500 mt-0.5">
              {eligible.length} recipient{eligible.length !== 1 ? "s" : ""}
              {skipped > 0 && ` · ${skipped} without email skipped`}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {result ? (
            <div className="text-center py-6 space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div className="text-lg font-semibold text-stone-900">Broadcast complete</div>
              <div className="text-sm text-stone-600 space-y-1">
                <div><strong className="text-emerald-600">{result.sent}</strong> sent successfully</div>
                {result.failed > 0 && <div><strong className="text-rose-600">{result.failed}</strong> failed</div>}
              </div>
              {result.failed > 0 && (
                <details className="text-left max-w-md mx-auto">
                  <summary className="cursor-pointer text-xs text-stone-500">Show failures</summary>
                  <div className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto">
                    {result.details?.filter((d) => d.status === "failed").map((d, i) => (
                      <div key={i} className="bg-rose-50 border border-rose-200 rounded p-2">
                        <div className="font-medium text-rose-800">{d.email}</div>
                        <div className="text-rose-600 text-[10px]">{d.error}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From name">
                  <input value={fromName} onChange={(e) => setFromName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Reply-to email">
                  <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} className={inputCls} placeholder="you@yourcompany.com" />
                </Field>
              </div>

              <Field label="Subject">
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="e.g. New stock from {{firstName}}" />
              </Field>

              <Field label="Body">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className={`${inputCls} min-h-[180px] font-mono text-sm`}
                  placeholder={"Hi {{firstName}},\n\nWe just received a new selection of...\n\nBest regards,\n{{name}}"}
                />
              </Field>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
                <div className="font-semibold mb-1">Personalisation tags</div>
                <div className="flex flex-wrap gap-2">
                  <Tag>{`{{firstName}}`}</Tag>
                  <Tag>{`{{name}}`}</Tag>
                  <Tag>{`{{company}}`}</Tag>
                  <Tag>{`{{title}}`}</Tag>
                </div>
              </div>

              {/* Preview */}
              {eligible.length > 0 && (subject || body) && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-stone-700 uppercase tracking-wider">Preview</div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                        disabled={previewIdx === 0}
                        className="p-1 rounded hover:bg-stone-200 disabled:opacity-30"
                      ><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                      <span className="text-xs text-stone-500">{previewIdx + 1} / {eligible.length}</span>
                      <button
                        onClick={() => setPreviewIdx(Math.min(eligible.length - 1, previewIdx + 1))}
                        disabled={previewIdx >= eligible.length - 1}
                        className="p-1 rounded hover:bg-stone-200 disabled:opacity-30"
                      ><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-sm">
                    <div className="text-xs text-stone-500">To: {previewContact.name} &lt;{previewContact.email}&gt;</div>
                    <div className="font-semibold text-stone-900 mt-1">{personalize(subject, previewContact) || <em className="text-stone-400">(no subject)</em>}</div>
                    <div className="mt-2 text-stone-700 whitespace-pre-line">{personalize(body, previewContact) || <em className="text-stone-400">(no body)</em>}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim() || eligible.length === 0}
              className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {sending && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>}
              {sending ? "Sending…" : `Send to ${eligible.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400";

const Field = ({ label, children }) => (
  <label className="block">
    <div className="text-xs font-medium text-stone-600 mb-1">{label}</div>
    {children}
  </label>
);

const Tag = ({ children }) => (
  <code className="px-1.5 py-0.5 rounded bg-white text-blue-700 text-[11px] border border-blue-200">{children}</code>
);
