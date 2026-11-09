import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Lock, Users } from "lucide-react";
import Sheet from "../ui/Sheet";
import { Segmented } from "../ui/InventoryHeader";
import { deviceSettings, itemRefs } from "../../present/presentModel";
import { createPresentation, fetchPresentations, updatePresentation } from "../../../services/presentationsApi";

const MODES = [
  { id: "new", label: "New presentation" },
  { id: "add", label: "Add to existing" },
];

const AUDIENCE = [
  { id: "team", label: "Whole team" },
  { id: "me", label: "Only me" },
];

const pieces = (n) => `${n} piece${n === 1 ? "" : "s"}`;

/**
 * Keeps the selected stones and jewelry as a named presentation, to open on
 * the iPad later (Presentations). Either a new one, or added to the end of
 * one already saved; pieces it already has are not added twice.
 */
const SavePresentationSheet = ({ open, items, variant, onClose }) => {
  const navigate = useNavigate();
  const nameRef = useRef(null);
  const [mode, setMode] = useState("new");
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("team");
  const [list, setList] = useState(null);
  const [listError, setListError] = useState("");
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("new");
    setName("");
    setTarget(null);
    setList(null);
    setListError("");
    fetchPresentations()
      .then(setList)
      .catch((err) => setListError(err.message || "Couldn't load the presentations"));
  }, [open]);

  const refs = itemRefs(items);
  const chosen = list?.find((p) => p.id === target) || null;
  const adding = chosen ? refs.filter((r) => !chosen.items.includes(r)) : [];
  const canSave = !busy && refs.length > 0 && (mode === "new" ? name.trim().length > 0 : Boolean(chosen) && adding.length > 0);

  const done = (p, message) => {
    toast.success(
      (t) => (
        <span>
          {message}{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              toast.dismiss(t.id);
              navigate(`/presentations?open=${p.id}`);
            }}
          >
            Open
          </button>
        </span>
      ),
      { duration: 6000 }
    );
    onClose();
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      if (mode === "new") {
        const p = await createPresentation({
          name: name.trim(),
          items: refs,
          settings: deviceSettings(),
          shared: audience === "team",
        });
        done(p, `Saved “${p.name}” · ${pieces(p.items.length)}.`);
      } else {
        const p = await updatePresentation(chosen.id, { items: [...chosen.items, ...adding] });
        done(p, `Added ${pieces(adding.length)} to “${p.name}”.`);
      }
    } catch (err) {
      toast.error(err.message || "Couldn't save the presentation");
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      <button type="button" className="inv-btn inv-btn--plain" onClick={onClose}>
        Cancel
      </button>
      <button type="button" className="inv-btn inv-btn--primary" onClick={save} disabled={!canSave} aria-busy={busy}>
        {busy ? "Saving…" : mode === "new" ? "Save" : adding.length ? `Add ${pieces(adding.length)}` : "Add"}
      </button>
    </>
  );

  return (
    <Sheet
      open={open}
      variant={variant}
      onClose={busy ? () => {} : onClose}
      title="Save as presentation"
      titleId="inv-pres-title"
      closeLabel="Close"
      footer={footer}
      initialFocus={variant === "bottom" ? undefined : nameRef}
    >
      <form
        className="inv-memo"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <section className="inv-memo-section">
          <Segmented label="Save to" options={MODES} value={mode} onChange={setMode} className="inv-memo-kind" />
          <p className="inv-fnote inv-memo-kind-note">
            {pieces(refs.length)} selected. Prices and photos stay live: the presentation always shows the inventory as it is.
          </p>
        </section>

        {mode === "new" ? (
          <section className="inv-memo-section">
            <label className="inv-memo-field">
              <span className="inv-memo-label">Name</span>
              <input
                ref={nameRef}
                className="inv-input"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hong Kong · March"
              />
            </label>
            <div className="inv-memo-field">
              <span className="inv-memo-label">Who can open and edit it</span>
              <Segmented label="Who can open and edit it" options={AUDIENCE} value={audience} onChange={setAudience} className="inv-memo-kind" />
            </div>
          </section>
        ) : (
          <section className="inv-memo-section">
            {listError ? (
              <p className="inv-fnote inv-memo-warn">{listError}</p>
            ) : !list ? (
              <p className="inv-fnote">Loading presentations…</p>
            ) : !list.length ? (
              <p className="inv-fnote">No saved presentations yet. Save this selection as a new one.</p>
            ) : (
              <ul className="inv-pres-list" role="radiogroup" aria-label="Presentation">
                {list.map((p) => {
                  const on = p.id === target;
                  const fresh = refs.filter((r) => !p.items.includes(r)).length;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className="inv-pres-row"
                        onClick={() => setTarget(p.id)}
                      >
                        <span className="inv-pres-name">{p.name}</span>
                        <span className="inv-memo-meta">
                          {pieces(p.items.length)}
                          {fresh < refs.length ? ` · ${refs.length - fresh} already in it` : ""}
                        </span>
                        {p.shared ? (
                          <Users size={15} strokeWidth={1.75} aria-label="Shared with the team" />
                        ) : (
                          <Lock size={15} strokeWidth={1.75} aria-label="Only you" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {chosen && !adding.length && <p className="inv-fnote">Everything selected is already in “{chosen.name}”.</p>}
          </section>
        )}
      </form>
    </Sheet>
  );
};

export default SavePresentationSheet;
