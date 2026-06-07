import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  getJewelrySettings,
  saveJewelrySettings,
  JEWELRY_CATEGORIES,
  JEWELRY_STATUSES,
} from "../../services/jewelrySettingsApi";

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const Card = ({ title, description, icon, action, children }) => (
  <section className="rounded-2xl glass-surface p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-canvas-2 text-app-graphite ring-1 ring-app-line">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-app-ink">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-app-soft">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const Chip = ({ children, tone = "muted", onRemove }) => {
  const tones = {
    muted: "bg-app-canvas-2 text-app-graphite ring-app-line",
    emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ${tones[tone]}`}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-0.5 rounded-full p-0.5 text-app-soft transition-colors hover:bg-app-line hover:text-app-ink"
          aria-label="Remove"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
};

const BackendNote = ({ children }) => (
  <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-app-line bg-app-canvas-2/50 px-3 py-2 text-[11.5px] leading-relaxed text-app-soft">
    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>{children}</span>
  </div>
);

const inputCls =
  "h-9 rounded-lg border border-app-line bg-app-canvas-2 px-3 text-[13px] text-app-ink placeholder:text-app-soft focus:border-app-line-2 focus:outline-none";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const JewelrySettings = () => {
  const [settings, setSettings] = useState(() => getJewelrySettings());

  // Local editable copies
  const [markup, setMarkup] = useState(String(settings.defaultMarkupPercent ?? 0));
  const [newCategory, setNewCategory] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");

  useEffect(() => {
    setMarkup(String(settings.defaultMarkupPercent ?? 0));
  }, [settings.defaultMarkupPercent]);

  const persist = (patch) => {
    const next = saveJewelrySettings(patch);
    setSettings(next);
    return next;
  };

  /* --- Pricing --- */
  const markupChanged =
    String(settings.defaultMarkupPercent ?? 0) !== String(markup).trim();

  const saveMarkup = () => {
    const v = Number(markup);
    if (!Number.isFinite(v) || v < 0) {
      toast.error("Markup must be a number ≥ 0");
      return;
    }
    persist({ defaultMarkupPercent: v });
    toast.success("Default markup saved");
  };

  /* --- Categories --- */
  const customCategories = settings.customCategories || [];
  const builtInLower = useMemo(
    () => new Set(JEWELRY_CATEGORIES.map((c) => c.toLowerCase())),
    []
  );

  const addCategory = () => {
    const value = newCategory.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    if (builtInLower.has(lower) || customCategories.some((c) => c.toLowerCase() === lower)) {
      toast.error("That category already exists");
      return;
    }
    persist({ customCategories: [...customCategories, value] });
    setNewCategory("");
    toast.success(`Added “${value}”`);
  };

  const removeCategory = (cat) => {
    persist({
      customCategories: customCategories.filter((c) => c !== cat),
    });
  };

  /* --- Custom fields --- */
  const customFields = settings.customFields || [];

  const addField = () => {
    const label = fieldLabel.trim();
    if (!label) return;
    if (customFields.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      toast.error("A field with that label already exists");
      return;
    }
    const field = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      type: fieldType,
    };
    persist({ customFields: [...customFields, field] });
    setFieldLabel("");
    setFieldType("text");
    toast.success(`Added field “${label}”`);
  };

  const removeField = (id) => {
    persist({ customFields: customFields.filter((f) => f.id !== id) });
  };

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="text-2xl font-semibold tracking-tight text-app-ink">
          Jewelry Settings
        </h1>
        <span className="text-sm text-app-muted">Workshop defaults</span>
      </div>
      <p className="mb-6 text-xs text-app-soft">
        Pricing defaults, categories, production statuses and custom fields.
      </p>

      <div className="space-y-4">
        {/* Pricing */}
        <Card
          title="Default markup"
          description="Applied as the starting markup for new pieces. Sale price = total cost × (1 + markup%)."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-app-soft">
                Default markup (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={markup}
                  onChange={(e) => setMarkup(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveMarkup()}
                  className={`${inputCls} w-32 pr-7 tabular-nums`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-app-soft">
                  %
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={saveMarkup}
              disabled={!markupChanged}
              className="h-9 rounded-lg bg-app-ink px-4 text-[13px] font-medium text-app-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </Card>

        {/* Categories */}
        <Card
          title="Categories"
          description="Built-in categories plus your own. Custom categories appear in the New Item dropdown."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 014 12V7a4 4 0 014-4z" />
            </svg>
          }
        >
          <div className="space-y-3">
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-app-soft">
                Built-in
              </div>
              <div className="flex flex-wrap gap-1.5">
                {JEWELRY_CATEGORIES.map((c) => (
                  <Chip key={c}>{c}</Chip>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-app-soft">
                Custom
              </div>
              {customCategories.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {customCategories.map((c) => (
                    <Chip key={c} tone="emerald" onRemove={() => removeCategory(c)}>
                      {c}
                    </Chip>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-[12.5px] text-app-soft">No custom categories yet.</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  placeholder="e.g. Anklet, Tiara…"
                  className={`${inputCls} w-56`}
                />
                <button
                  type="button"
                  onClick={addCategory}
                  disabled={!newCategory.trim()}
                  className="h-9 rounded-lg border border-app-line bg-app-canvas-2 px-3 text-[13px] font-medium text-app-graphite transition-colors hover:border-app-line-2 hover:text-app-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add category
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Statuses (read-only) */}
        <Card
          title="Production statuses"
          description="The workshop pipeline stages, in order. These drive the production board columns."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {JEWELRY_STATUSES.map((s, i) => (
              <React.Fragment key={s.value}>
                <Chip>{s.label}</Chip>
                {i < JEWELRY_STATUSES.length - 1 && (
                  <span className="text-app-soft" aria-hidden>·</span>
                )}
              </React.Fragment>
            ))}
          </div>
          <BackendNote>
            Statuses are tied to the production workflow logic, so they're read-only
            here. Adding, renaming or reordering stages requires a backend change.
          </BackendNote>
        </Card>

        {/* Custom fields */}
        <Card
          title="Custom fields"
          description="Define extra fields you want to track on jewelry pieces."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
        >
          {customFields.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {customFields.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-app-line bg-app-canvas-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="text-[13px] font-medium text-app-ink">{f.label}</span>
                    <span className="ml-2 rounded-full bg-app-line px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-app-soft">
                      {f.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeField(f.id)}
                    className="text-app-soft transition-colors hover:text-red-500"
                    aria-label={`Remove ${f.label}`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={fieldLabel}
              onChange={(e) => setFieldLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addField()}
              placeholder="Field label, e.g. Engraving"
              className={`${inputCls} min-w-[200px] flex-1`}
            />
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value)}
              className={inputCls}
              aria-label="Field type"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addField}
              disabled={!fieldLabel.trim()}
              className="h-9 rounded-lg border border-app-line bg-app-canvas-2 px-3 text-[13px] font-medium text-app-graphite transition-colors hover:border-app-line-2 hover:text-app-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add field
            </button>
          </div>

          <BackendNote>
            Field definitions are saved on this device. Attaching their values to
            individual pieces (and sharing them across your team) needs the backend
            jewelry-settings endpoint.
          </BackendNote>
        </Card>

        {/* Persistence disclosure */}
        <p className="px-1 text-[11px] leading-relaxed text-app-soft">
          Settings are stored locally in this browser. When the backend
          jewelry-settings endpoint is available they'll sync across your team
          automatically — no changes needed here.
        </p>
      </div>
    </div>
  );
};

export default JewelrySettings;
