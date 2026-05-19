import React, { useRef, useState } from "react";
import toast from "react-hot-toast";
import { updateContact } from "../../../services/crmApi";
import { downscaleImage, makeThumbnail } from "../utils/cardImage";

/**
 * AttachCardModal — bolts a business-card image onto an *existing*
 * contact.
 *
 * Why not reuse ScanCardModal? That flow is designed around creating a
 * new contact from scratch: it runs OCR, suggests duplicates, lets you
 * split / merge two-people cards, etc. Here the contact already exists
 * — the user just wants to attach (or update) the visual asset. So this
 * modal is deliberately tiny: take/upload front, optional back, save.
 *
 * No OCR. No verification. Just an image attached + thumbnail for the
 * inline list cell.
 *
 * Props:
 *   - contact: the contact being augmented (used for header + id)
 *   - onClose:   close the modal
 *   - onSaved:   called with the updated contact so the parent can
 *                refresh the row and its inline thumbnail without a
 *                full re-fetch.
 */
export default function AttachCardModal({ contact, onClose, onSaved }) {
  const fileFrontRef = useRef(null);
  const cameraFrontRef = useRef(null);
  const fileBackRef = useRef(null);
  const cameraBackRef = useRef(null);

  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [saving, setSaving] = useState(false);

  const pickFront = () => cameraFrontRef.current?.click();
  const uploadFront = () => fileFrontRef.current?.click();
  const pickBack = () => cameraBackRef.current?.click();
  const uploadBack = () => fileBackRef.current?.click();

  const handleFile = async (file, side) => {
    if (!file) return;
    try {
      const dataUrl = await downscaleImage(file);
      if (side === "front") setFront(dataUrl);
      else setBack(dataUrl);
    } catch (_) {
      toast.error("Couldn't load image");
    }
  };

  const handleSave = async () => {
    if (!front && !back) {
      toast.error("Add at least the front of the card");
      return;
    }
    setSaving(true);
    try {
      // Thumbnail comes from whichever side we have first preference for.
      // Falling back to the back if the user only attached a back side.
      const thumbSource = front || back;
      const thumb = thumbSource ? await makeThumbnail(thumbSource) : null;
      const updated = await updateContact(contact.id, {
        cardImageFront: front,
        cardImageBack: back,
        cardImageThumb: thumb,
      });
      toast.success("Business card saved");
      onSaved?.({ contact: updated, thumb });
      onClose();
    } catch (e) {
      toast.error(e.message || "Could not save the card");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-stone-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-2xl rounded-t-2xl w-full sm:max-w-md shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold text-stone-900 truncate">
              Add business card
            </h3>
            <div className="text-xs text-stone-500 mt-0.5 truncate">
              {contact?.name || "Contact"}
              {contact?.company ? ` · ${contact.company}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* FRONT slot */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-stone-700 uppercase tracking-wider">Front of card</div>
              {front && (
                <button
                  onClick={() => setFront(null)}
                  className="text-[11px] text-stone-500 hover:text-stone-900"
                >
                  Remove
                </button>
              )}
            </div>
            {front ? (
              <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
                <img src={front} alt="Front of card" className="w-full object-contain max-h-64" />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-stone-900/80 text-white text-[10px] font-semibold tracking-wider">
                  FRONT
                </div>
              </div>
            ) : (
              <CapturePair
                onCamera={pickFront}
                onUpload={uploadFront}
                cameraRef={cameraFrontRef}
                fileRef={fileFrontRef}
                onFile={(f) => handleFile(f, "front")}
              />
            )}
          </div>

          {/* BACK slot — optional */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Back of card <span className="text-stone-400 font-normal normal-case">(optional)</span>
              </div>
              {back && (
                <button
                  onClick={() => setBack(null)}
                  className="text-[11px] text-stone-500 hover:text-stone-900"
                >
                  Remove
                </button>
              )}
            </div>
            {back ? (
              <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
                <img src={back} alt="Back of card" className="w-full object-contain max-h-64" />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-stone-900/80 text-white text-[10px] font-semibold tracking-wider">
                  BACK
                </div>
              </div>
            ) : (
              <CapturePair
                onCamera={pickBack}
                onUpload={uploadBack}
                cameraRef={cameraBackRef}
                fileRef={fileBackRef}
                onFile={(f) => handleFile(f, "back")}
                compact
              />
            )}
          </div>

          <p className="text-[11px] text-stone-500">
            The image is stored on the contact and shown as a thumbnail in
            the contacts list. Click it any time to view full-size.
          </p>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!front && !back)}
            className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save card"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Camera + upload affordance pair, matches ScanCardModal styling ---- */
function CapturePair({ onCamera, onUpload, cameraRef, fileRef, onFile, compact }) {
  return (
    <div className="space-y-2">
      <button
        onClick={onCamera}
        className={`w-full flex items-center gap-3 ${compact ? "p-3" : "p-4"} rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-500 hover:bg-stone-50 text-left`}
      >
        <div className={`${compact ? "w-10 h-10" : "w-12 h-12"} rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0`}>
          <svg className={compact ? "w-5 h-5" : "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <div className="font-medium text-stone-900 text-sm">Take photo</div>
          <div className="text-[11px] text-stone-500">Use the back camera</div>
        </div>
      </button>
      <button
        onClick={onUpload}
        className={`w-full flex items-center gap-3 ${compact ? "p-3" : "p-4"} rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-500 hover:bg-stone-50 text-left`}
      >
        <div className={`${compact ? "w-10 h-10" : "w-12 h-12"} rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0`}>
          <svg className={compact ? "w-5 h-5" : "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <div className="font-medium text-stone-900 text-sm">Upload from gallery</div>
          <div className="text-[11px] text-stone-500">Pick an existing photo</div>
        </div>
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
