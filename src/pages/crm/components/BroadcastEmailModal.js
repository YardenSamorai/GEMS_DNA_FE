import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  sendEmailBroadcast,
  fetchOutlookStatus,
  fetchEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "../../../services/crmApi";
import {
  EMAIL_TEMPLATES,
  EMAIL_BLOCKS,
  PERSONALISATION_TAGS,
  htmlToPlainText,
} from "./emailTemplates";

/**
 * Professional email broadcast composer with:
 *  - Pre-built HTML template gallery
 *  - Visual block insertion (Heading, Button, Image, Divider, etc.)
 *  - Raw HTML source editor
 *  - Live preview (desktop / mobile widths)
 *  - Save/load custom templates per user
 *  - Outlook / Resend sender selector
 *  - Personalisation tag chips
 */
export default function BroadcastEmailModal({ recipients = [], onClose, onSent }) {
  const { user } = useUser();

  // Composer state
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState(EMAIL_TEMPLATES[0].html);
  const [fromName, setFromName] = useState(user?.fullName || "GEMS DNA");
  const [replyTo, setReplyTo] = useState(user?.primaryEmailAddress?.emailAddress || "");
  const [provider, setProvider] = useState("resend");
  const [outlookStatus, setOutlookStatus] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState("design"); // design | source | templates | mine
  const [previewWidth, setPreviewWidth] = useState("desktop"); // desktop | mobile
  const [previewIdx, setPreviewIdx] = useState(0);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // Saved templates
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [savingTpl, setSavingTpl] = useState(false);

  const htmlRef = useRef(null); // textarea ref for cursor-based insertion

  useEffect(() => {
    if (!user?.id) return;
    fetchOutlookStatus(user.id)
      .then((s) => {
        setOutlookStatus(s);
        if (s?.connected) setProvider("outlook");
      })
      .catch(() => {});
    fetchEmailTemplates(user.id)
      .then(setSavedTemplates)
      .catch(() => {});
  }, [user?.id]);

  const eligible = useMemo(() => recipients.filter((r) => r.email), [recipients]);
  const skipped = recipients.length - eligible.length;

  const personalize = useCallback((template, c) => {
    if (!template) return "";
    const firstName = (c.name || "").split(/\s+/)[0] || "";
    return template
      .replace(/\{\{?\s*name\s*\}?\}/gi, escapeHtml(c.name || ""))
      .replace(/\{\{?\s*firstName\s*\}?\}/gi, escapeHtml(firstName))
      .replace(/\{\{?\s*company\s*\}?\}/gi, escapeHtml(c.company || ""))
      .replace(/\{\{?\s*title\s*\}?\}/gi, escapeHtml(c.title || ""));
  }, []);

  const previewContact =
    eligible[previewIdx] || { name: "Sample Contact", email: "sample@example.com", company: "Acme Inc.", title: "Director" };

  /* ---------- editor helpers ---------- */
  const insertAtCursor = (text) => {
    const ta = htmlRef.current;
    if (!ta) {
      setHtml((h) => h + text);
      return;
    }
    const start = ta.selectionStart ?? html.length;
    const end = ta.selectionEnd ?? html.length;
    const next = html.slice(0, start) + text + html.slice(end);
    setHtml(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleLoadTemplate = (tpl) => {
    if (html.trim() && !window.confirm("Replace the current message with this template?")) return;
    setHtml(tpl.html);
    if (tpl.subject) setSubject(tpl.subject);
    setActiveTab("design");
    toast.success(`Loaded "${tpl.name}"`);
  };

  const handleSaveTemplate = async () => {
    const name = prompt("Save template as:", `My template ${savedTemplates.length + 1}`);
    if (!name?.trim()) return;
    setSavingTpl(true);
    try {
      const created = await createEmailTemplate({
        userId: user.id,
        name: name.trim(),
        subject,
        html,
      });
      setSavedTemplates((arr) => [created, ...arr]);
      toast.success("Template saved");
    } catch (e) { toast.error(e.message); }
    finally { setSavingTpl(false); }
  };

  const handleUpdateTemplate = async (tpl) => {
    if (!window.confirm(`Overwrite "${tpl.name}" with the current message?`)) return;
    try {
      const updated = await updateEmailTemplate(tpl.id, { subject, html });
      setSavedTemplates((arr) => arr.map((t) => (t.id === tpl.id ? updated : t)));
      toast.success("Template updated");
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteTemplate = async (tpl) => {
    if (!window.confirm(`Delete "${tpl.name}"?`)) return;
    try {
      await deleteEmailTemplate(tpl.id);
      setSavedTemplates((arr) => arr.filter((t) => t.id !== tpl.id));
      toast.success("Deleted");
    } catch (e) { toast.error(e.message); }
  };

  /* ---------- send ---------- */
  const handleSend = async () => {
    if (!subject.trim() || !html.trim()) {
      toast.error("Subject and message are required");
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
        text: htmlToPlainText(html),
        html,
        fromName,
        replyTo: replyTo || undefined,
        provider,
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

  /* ---------- success view ---------- */
  if (result) {
    return (
      <ModalShell onClose={onClose}>
        <Header onClose={onClose} count={eligible.length} skipped={skipped} />
        <div className="flex-1 overflow-y-auto p-8">
          <div className="text-center py-6 space-y-3 max-w-sm mx-auto">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-lg font-semibold text-stone-900">Broadcast complete</div>
            <div className="text-sm text-stone-600 space-y-1">
              <div><strong className="text-emerald-600">{result.sent}</strong> sent successfully</div>
              {result.failed > 0 && <div><strong className="text-rose-600">{result.failed}</strong> failed</div>}
            </div>
            {result.failed > 0 && (
              <details className="text-left">
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
        </div>
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800">Close</button>
        </div>
      </ModalShell>
    );
  }

  /* ---------- main composer ---------- */
  return (
    <ModalShell onClose={onClose} wide>
      <Header onClose={onClose} count={eligible.length} skipped={skipped} />

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
        {/* LEFT — composer */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-stone-200">
          {/* Sender + meta */}
          <div className="px-5 pt-4 pb-3 border-b border-stone-200 space-y-3 shrink-0">
            <SenderRow
              provider={provider}
              setProvider={setProvider}
              outlookStatus={outlookStatus}
              fromName={fromName}
              setFromName={setFromName}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
            />
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
                placeholder="e.g. New stock from {{firstName}}"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-3 border-b border-stone-200 shrink-0">
            <div className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-hide">
              <TabBtn active={activeTab === "templates"} onClick={() => setActiveTab("templates")}>Templates</TabBtn>
              <TabBtn active={activeTab === "design"} onClick={() => setActiveTab("design")}>Design</TabBtn>
              <TabBtn active={activeTab === "source"} onClick={() => setActiveTab("source")}>HTML</TabBtn>
              <TabBtn active={activeTab === "mine"} onClick={() => setActiveTab("mine")}>
                My templates
                {savedTemplates.length > 0 && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-600">{savedTemplates.length}</span>}
              </TabBtn>
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5 min-h-0">
            {activeTab === "templates" && (
              <TemplateGallery templates={EMAIL_TEMPLATES} onPick={handleLoadTemplate} personalize={personalize} previewContact={previewContact} />
            )}
            {activeTab === "mine" && (
              <SavedTemplates
                templates={savedTemplates}
                onLoad={handleLoadTemplate}
                onUpdate={handleUpdateTemplate}
                onDelete={handleDeleteTemplate}
                personalize={personalize}
                previewContact={previewContact}
              />
            )}
            {activeTab === "design" && (
              <DesignTab
                html={html}
                setHtml={setHtml}
                htmlRef={htmlRef}
                onInsert={insertAtCursor}
                onSaveTemplate={handleSaveTemplate}
                savingTpl={savingTpl}
              />
            )}
            {activeTab === "source" && (
              <SourceTab
                html={html}
                setHtml={setHtml}
                htmlRef={htmlRef}
                onInsert={insertAtCursor}
                onSaveTemplate={handleSaveTemplate}
                savingTpl={savingTpl}
              />
            )}
          </div>
        </div>

        {/* RIGHT — live preview */}
        <div className="hidden lg:flex w-[440px] xl:w-[500px] shrink-0 flex-col bg-stone-100">
          <PreviewPanel
            previewWidth={previewWidth}
            setPreviewWidth={setPreviewWidth}
            eligible={eligible}
            previewIdx={previewIdx}
            setPreviewIdx={setPreviewIdx}
            previewContact={previewContact}
            subject={subject}
            html={html}
            personalize={personalize}
            fromName={fromName}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2 shrink-0">
        <div className="text-xs text-stone-500 hidden sm:block">
          Sending via <strong className="text-stone-700">{provider === "outlook" ? "Outlook" : "Resend"}</strong>
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Cancel</button>
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !html.trim() || eligible.length === 0}
            className="px-5 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {sending && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {sending ? "Sending…" : `Send to ${eligible.length}`}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ============== sub-components ============== */

const ModalShell = ({ children, onClose, wide }) => (
  <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-3 bg-stone-900/60 backdrop-blur-sm" onClick={onClose}>
    <div
      onClick={(e) => e.stopPropagation()}
      className={`bg-white sm:rounded-2xl rounded-t-2xl w-full ${wide ? "sm:max-w-[1280px]" : "sm:max-w-2xl"} shadow-2xl max-h-[96vh] flex flex-col overflow-hidden`}
    >
      {children}
    </div>
  </div>
);

const Header = ({ onClose, count, skipped }) => (
  <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between shrink-0">
    <div>
      <h3 className="font-semibold text-stone-900">Email broadcast</h3>
      <div className="text-xs text-stone-500 mt-0.5">
        {count} recipient{count !== 1 ? "s" : ""}
        {skipped > 0 && ` · ${skipped} without email skipped`}
      </div>
    </div>
    <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
      <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
      active ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
    }`}
  >
    {children}
  </button>
);

function SenderRow({ provider, setProvider, outlookStatus, fromName, setFromName, replyTo, setReplyTo }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <SenderOption
          active={provider === "resend"}
          onClick={() => setProvider("resend")}
          title="Resend"
          subtitle="Marketing email"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
        />
        <SenderOption
          active={provider === "outlook"}
          disabled={!outlookStatus?.connected}
          onClick={() => {
            if (!outlookStatus?.connected) {
              toast.error("Outlook is not connected. Connect it in CRM Settings.");
              return;
            }
            setProvider("outlook");
          }}
          title="Outlook"
          subtitle={outlookStatus?.connected ? outlookStatus.accountEmail : "Not connected"}
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6.5l9-1.5v13l-9-1.5V6.5zm10-1.5h7a1 1 0 011 1v12a1 1 0 01-1 1h-7V5z" /></svg>}
        />
      </div>
      {!outlookStatus?.connected && (
        <div className="text-[11px] text-stone-500">
          Want to send from your Outlook? <Link to="/crm/settings" className="text-stone-900 underline">Connect Outlook</Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={provider === "outlook" && outlookStatus?.accountName ? outlookStatus.accountName : fromName}
          onChange={(e) => setFromName(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
          disabled={provider === "outlook"}
          placeholder="From name"
        />
        <input
          value={provider === "outlook" ? (outlookStatus?.accountEmail || "") : replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
          placeholder={provider === "outlook" ? "Sender" : "Reply-to email"}
          disabled={provider === "outlook"}
        />
      </div>
    </div>
  );
}

const SenderOption = ({ active, disabled, onClick, title, subtitle, icon }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
      active ? "border-stone-900 bg-stone-50 ring-1 ring-stone-900" : "border-stone-200 hover:border-stone-400 bg-white"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    <div className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${active ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-xs font-medium text-stone-900">{title}</div>
      <div className="text-[10px] text-stone-500 truncate">{subtitle}</div>
    </div>
  </button>
);

/* ----- Templates gallery ----- */
function TemplateGallery({ templates, onPick, personalize, previewContact }) {
  return (
    <div>
      <div className="text-xs text-stone-500 mb-3">Pick a starting point. You can fully customise the design after loading.</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map((tpl) => (
          <TemplateCard key={tpl.id} tpl={tpl} onPick={onPick} personalize={personalize} previewContact={previewContact} />
        ))}
      </div>
    </div>
  );
}

const TemplateCard = ({ tpl, onPick, personalize, previewContact }) => (
  <button
    type="button"
    onClick={() => onPick(tpl)}
    className="group text-left rounded-xl border border-stone-200 bg-white overflow-hidden hover:border-stone-900 hover:shadow-md transition-all"
  >
    <div className="aspect-[4/3] bg-stone-50 overflow-hidden border-b border-stone-200 relative">
      <div
        style={{
          width: "600px",
          transform: "scale(0.40)",
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
        dangerouslySetInnerHTML={{ __html: personalize(tpl.html, previewContact) }}
      />
    </div>
    <div className="p-3">
      <div className="font-semibold text-sm text-stone-900">{tpl.name}</div>
      <div className="text-xs text-stone-500 mt-0.5">{tpl.description}</div>
    </div>
  </button>
);

/* ----- Saved templates ----- */
function SavedTemplates({ templates, onLoad, onUpdate, onDelete, personalize, previewContact }) {
  if (templates.length === 0) {
    return (
      <div className="text-center py-12 text-stone-500">
        <div className="mx-auto w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
        </div>
        <div className="text-sm font-medium text-stone-700">No saved templates yet</div>
        <div className="text-xs mt-1">Design a message and click "Save as template" to keep it.</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {templates.map((tpl) => (
        <div key={tpl.id} className="group rounded-xl border border-stone-200 bg-white overflow-hidden hover:border-stone-900 transition-all">
          <button type="button" onClick={() => onLoad(tpl)} className="block w-full text-left">
            <div className="aspect-[4/3] bg-stone-50 overflow-hidden border-b border-stone-200">
              <div
                style={{ width: "600px", transform: "scale(0.40)", transformOrigin: "top left", pointerEvents: "none" }}
                dangerouslySetInnerHTML={{ __html: personalize(tpl.html, previewContact) }}
              />
            </div>
            <div className="p-3">
              <div className="font-semibold text-sm text-stone-900 truncate">{tpl.name}</div>
              <div className="text-xs text-stone-500 truncate mt-0.5">{tpl.subject || <em>No subject</em>}</div>
            </div>
          </button>
          <div className="px-3 pb-3 flex items-center gap-2">
            <button onClick={() => onUpdate(tpl)} className="text-[11px] px-2 py-1 rounded border border-stone-200 hover:bg-stone-100 text-stone-700">Update</button>
            <button onClick={() => onDelete(tpl)} className="text-[11px] px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 ml-auto">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----- Design tab — block toolbar + textarea ----- */
function DesignTab({ html, setHtml, htmlRef, onInsert, onSaveTemplate, savingTpl }) {
  return (
    <div className="space-y-3">
      <Toolbar onInsert={onInsert} onSaveTemplate={onSaveTemplate} savingTpl={savingTpl} />
      <textarea
        ref={htmlRef}
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        className="w-full min-h-[420px] px-4 py-3 text-sm rounded-lg border border-stone-200 bg-white font-mono leading-relaxed focus:outline-none focus:border-stone-400"
        placeholder="Start typing or insert a block…"
      />
      <div className="text-[11px] text-stone-500">
        Tip: switch to <strong>HTML</strong> tab for pure code editing, or <strong>Templates</strong> to start from a beautiful preset.
      </div>
    </div>
  );
}

/* ----- HTML source tab ----- */
function SourceTab({ html, setHtml, htmlRef, onInsert, onSaveTemplate, savingTpl }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PERSONALISATION_TAGS.map((p) => (
            <button
              key={p.tag}
              onClick={() => onInsert(p.tag)}
              className="text-[11px] font-mono px-2 py-1 rounded border border-stone-200 bg-white hover:border-stone-900 text-stone-700"
              title={p.label}
            >{p.tag}</button>
          ))}
        </div>
        <button
          onClick={onSaveTemplate}
          disabled={savingTpl}
          className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {savingTpl ? "Saving…" : "Save as template"}
        </button>
      </div>
      <textarea
        ref={htmlRef}
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        spellCheck={false}
        className="w-full min-h-[480px] px-4 py-3 text-xs rounded-lg border border-stone-200 bg-stone-950 text-emerald-200 font-mono leading-relaxed focus:outline-none focus:border-stone-400"
        placeholder="<div>Your HTML here…</div>"
      />
      <div className="text-[11px] text-stone-500">
        Use full inline CSS for best email-client compatibility. External stylesheets are stripped by Gmail and most clients.
      </div>
    </div>
  );
}

/* ----- Block + tag toolbar (for Design tab) ----- */
function Toolbar({ onInsert, onSaveTemplate, savingTpl }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">Insert block</div>
        <div className="flex flex-wrap gap-1.5">
          {EMAIL_BLOCKS.map((b) => (
            <button
              key={b.id}
              onClick={() => onInsert(b.html)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-stone-200 bg-white hover:border-stone-900 text-stone-700 hover:text-stone-900 transition-colors"
            >+ {b.label}</button>
          ))}
        </div>
      </div>
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">Personalise</div>
          <div className="flex flex-wrap gap-1.5">
            {PERSONALISATION_TAGS.map((p) => (
              <button
                key={p.tag}
                onClick={() => onInsert(p.tag)}
                className="text-[11px] font-mono px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400"
                title={p.label}
              >{p.tag}</button>
            ))}
          </div>
        </div>
        <button
          onClick={onSaveTemplate}
          disabled={savingTpl}
          className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {savingTpl ? "Saving…" : "Save as template"}
        </button>
      </div>
    </div>
  );
}

/* ----- Live preview panel ----- */
function PreviewPanel({ previewWidth, setPreviewWidth, eligible, previewIdx, setPreviewIdx, previewContact, subject, html, personalize, fromName }) {
  const widthPx = previewWidth === "mobile" ? 380 : "100%";
  return (
    <>
      <div className="px-4 py-3 border-b border-stone-200 bg-white flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">Live Preview</div>
        <div className="flex items-center gap-1">
          <div className="inline-flex rounded-md border border-stone-200 bg-stone-50 p-0.5">
            <ViewBtn active={previewWidth === "desktop"} onClick={() => setPreviewWidth("desktop")} title="Desktop">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
            </ViewBtn>
            <ViewBtn active={previewWidth === "mobile"} onClick={() => setPreviewWidth("mobile")} title="Mobile">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
            </ViewBtn>
          </div>
          {eligible.length > 0 && (
            <div className="inline-flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-md p-0.5">
              <button onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))} disabled={previewIdx === 0} className="p-1 rounded hover:bg-stone-200 disabled:opacity-30">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-[10px] text-stone-600 px-1">{previewIdx + 1} / {eligible.length}</span>
              <button onClick={() => setPreviewIdx(Math.min(eligible.length - 1, previewIdx + 1))} disabled={previewIdx >= eligible.length - 1} className="p-1 rounded hover:bg-stone-200 disabled:opacity-30">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Email "client" frame */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden transition-all" style={{ maxWidth: widthPx }}>
          <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
            <div className="text-[11px] text-stone-500">From: <strong className="text-stone-700">{fromName}</strong></div>
            <div className="text-[11px] text-stone-500">To: <strong className="text-stone-700">{previewContact.name}</strong> &lt;{previewContact.email}&gt;</div>
            <div className="text-sm font-semibold text-stone-900 mt-1.5 truncate">
              {personalize(subject, previewContact) || <em className="text-stone-400 font-normal">(no subject)</em>}
            </div>
          </div>
          <iframe
            title="Email preview"
            srcDoc={personalize(html, previewContact) || "<div style='padding:40px;text-align:center;color:#a8a29e;font-family:sans-serif;'>Your email preview will appear here</div>"}
            sandbox=""
            className="w-full bg-white border-0 block"
            style={{ height: previewWidth === "mobile" ? 600 : 700 }}
          />
        </div>
      </div>
    </>
  );
}

const ViewBtn = ({ active, onClick, title, children }) => (
  <button onClick={onClick} title={title} className={`p-1.5 rounded ${active ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"}`}>
    {children}
  </button>
);

/* ----- helpers ----- */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
