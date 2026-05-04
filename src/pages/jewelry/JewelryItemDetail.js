import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  changeJewelryStatus,
  deleteJewelryFile,
  deleteJewelryItem,
  fetchJewelryItem,
  registerJewelryFile,
  updateJewelryItem,
  JEWELRY_STATUSES,
  JEWELRY_CATEGORIES,
  FILE_KINDS,
} from "../../services/jewelryApi";
import StatusBadge from "./components/StatusBadge";
import FileUploader from "./components/FileUploader";
import FilesGallery from "./components/FilesGallery";
import CustomerPicker from "./components/CustomerPicker";
import StonesPanel from "./components/StonesPanel";
import MetalsPanel from "./components/MetalsPanel";
import CostsPanel from "./components/CostsPanel";
import HistoryTimeline from "./components/HistoryTimeline";
import SellItemModal from "./components/SellItemModal";
import ReadyNotifyBanner from "./components/ReadyNotifyBanner";
import WhatsAppCustomerButton from "./components/WhatsAppCustomerButton";
import { Skeleton, SkeletonText, SkeletonCard } from "../../components/ui/Skeleton";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "files", label: "Files" },
  { id: "stones", label: "Stones" },
  { id: "metals", label: "Metals" },
  { id: "costs", label: "Costs" },
  { id: "history", label: "History" },
];

const JewelryItemDetail = () => {
  const { id } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [defaultFileKind, setDefaultFileKind] = useState("progress");
  const [showSellModal, setShowSellModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJewelryItem(id);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load item");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = () => {
    if (!data?.item) return;
    setEditForm({
      name: data.item.name || "",
      category: data.item.category || "",
      contactId: data.item.contact_id || null,
      description: data.item.description || "",
      internalNotes: data.item.internal_notes || "",
      size: data.item.size || "",
      weightGrams: data.item.weight_grams || "",
      metalSummary: data.item.metal_summary || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      await updateJewelryItem(id, editForm);
      await load();
      setEditing(false);
    } catch (err) {
      alert(err.message || "Failed to save");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!data?.item) return;
    if (newStatus === data.item.status) return;
    try {
      await changeJewelryStatus(id, {
        newStatus,
        userId: user?.id,
      });
      await load();
    } catch (err) {
      alert(err.message || "Failed to change status");
    }
  };

  const handleFileUploaded = async (uploaded) => {
    try {
      await registerJewelryFile(id, {
        ...uploaded,
        kind: defaultFileKind,
        stage: data?.item?.status,
        uploadedBy: user?.id,
        setAsCover: !data?.item?.cover_image_url && (uploaded.mimeType || "").startsWith("image/"),
      });
      await load();
    } catch (err) {
      alert(err.message || "Failed to register file");
    }
  };

  const handleFileDelete = async (file) => {
    try {
      await deleteJewelryFile(id, file.id);
      await load();
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  };

  const handleSetCover = async (file) => {
    try {
      await updateJewelryItem(id, { coverImageUrl: file.url });
      await load();
    } catch (err) {
      alert(err.message || "Failed to set cover");
    }
  };

  const handleDeleteItem = async () => {
    if (!window.confirm("Delete this jewelry item permanently? This cannot be undone.")) return;
    try {
      await deleteJewelryItem(id);
      navigate("/jewelry/items");
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back link placeholder */}
        <Skeleton className="mb-4 h-3 w-32" />

        {/* Header: title + status badge + action buttons */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>

        {/* Tab strip placeholder */}
        <div className="mb-6 flex gap-1 border-b border-stone-200">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-none" />
          ))}
        </div>

        {/* Two-column body: cover image + details card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="aspect-square w-full rounded-xl lg:col-span-1" />
          <div className="space-y-4 lg:col-span-2">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={3} />
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <Skeleton className="mb-3 h-4 w-32" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                ))}
              </div>
            </div>
            <SkeletonText lines={3} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Item not found"}
        </div>
        <Link to="/inventory?tab=jewelry" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">
          ← Back to jewelry items
        </Link>
      </div>
    );
  }

  const { item, files, stones, metals, costs, history } = data;
  const isReadyToSell = item.status === "ready";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top breadcrumb / back */}
      <Link to="/inventory?tab=jewelry" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All jewelry items
      </Link>

      {/* Sticky header */}
      <div className="sticky top-0 z-10 mb-6 -mx-4 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:border-stone-200 sm:px-5 sm:shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold text-stone-900">{item.name}</h1>
              <StatusBadge status={item.status} />
              {item.type === "stock" && (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-700">
                  Stock
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
              <span className="font-mono">{item.sku}</span>
              {item.contact_name && <span>· {item.contact_name}</span>}
              {item.category && <span>· {item.category}</span>}
              {item.template_model_number && (
                <Link
                  to={`/${item.template_model_number}`}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
                  title="View the catalog template this job was made from"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  From {item.template_model_number}
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <WhatsAppCustomerButton item={item} userId={user?.id} />
            <select
              value={item.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:border-stone-400 focus:border-emerald-500 focus:outline-none"
            >
              {JEWELRY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {isReadyToSell && (
              <button
                onClick={() => setShowSellModal(true)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Sell
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Phase C: when the piece is ready and we have a customer, surface a
          prominent WhatsApp / email helper that also drops a touchpoint into
          the contact's CRM timeline. */}
      <ReadyNotifyBanner item={item} userId={user?.id} onLogged={load} />

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-stone-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            {t.label}
            {t.id === "files" && files.length > 0 && <span className="ml-1.5 text-xs text-stone-400">({files.length})</span>}
            {t.id === "stones" && stones.length > 0 && <span className="ml-1.5 text-xs text-stone-400">({stones.length})</span>}
            {t.id === "metals" && metals.length > 0 && <span className="ml-1.5 text-xs text-stone-400">({metals.length})</span>}
            {t.id === "costs" && costs.length > 0 && <span className="ml-1.5 text-xs text-stone-400">({costs.length})</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {/* Cover image */}
            {item.cover_image_url && (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                <img src={item.cover_image_url} alt={item.name} className="w-full object-cover" />
              </div>
            )}

            {/* Details card */}
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-stone-900">Details</h2>
                {!editing ? (
                  <button onClick={startEdit} className="text-sm text-emerald-700 hover:underline">Edit</button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      disabled={savingEdit}
                      className="text-sm text-stone-500 hover:text-stone-900 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={savingEdit}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {savingEdit ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>

              {!editing ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <DetailField label="Name" value={item.name} />
                  <DetailField label="Category" value={item.category} />
                  <DetailField
                    label="Customer"
                    value={
                      item.contact_id ? (
                        <Link
                          to={`/crm/customers/${item.contact_id}`}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          {item.contact_name || `Contact #${item.contact_id}`}
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7M21 3l-9 9M5 5h6v2H7v10h10v-4h2v6H5z" /></svg>
                        </Link>
                      ) : null
                    }
                  />
                  <DetailField
                    label="Linked deal"
                    value={
                      item.deal_id ? (
                        <Link
                          to={`/crm/deals?focus=${item.deal_id}`}
                          className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          <span className="truncate">{item.deal_title || `Deal #${item.deal_id}`}</span>
                          {item.deal_stage && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium uppercase">
                              {item.deal_stage}
                            </span>
                          )}
                        </Link>
                      ) : null
                    }
                  />
                  <DetailField label="Size" value={item.size} />
                  <DetailField label="Weight" value={item.weight_grams ? `${item.weight_grams} g` : null} />
                  <DetailField label="Metal" value={item.metal_summary} />
                  <DetailField label="Description" value={item.description} colSpan={2} />
                  <DetailField label="Internal notes" value={item.internal_notes} colSpan={2} />
                </dl>
              ) : (
                <div className="space-y-3">
                  <EditField label="Name">
                    <input className="input" value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </EditField>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="Category">
                      <select className="input" value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                        <option value="">—</option>
                        {JEWELRY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </EditField>
                    <EditField label="Size">
                      <input className="input" value={editForm.size}
                        onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} />
                    </EditField>
                  </div>
                  <EditField label="Customer">
                    <CustomerPicker
                      value={editForm.contactId}
                      onChange={(v) => setEditForm({ ...editForm, contactId: v })}
                    />
                  </EditField>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="Weight (grams)">
                      <input type="number" step="0.001" className="input" value={editForm.weightGrams}
                        onChange={(e) => setEditForm({ ...editForm, weightGrams: e.target.value })} />
                    </EditField>
                    <EditField label="Metal summary">
                      <input className="input" placeholder="18k Yellow Gold" value={editForm.metalSummary}
                        onChange={(e) => setEditForm({ ...editForm, metalSummary: e.target.value })} />
                    </EditField>
                  </div>
                  <EditField label="Description">
                    <textarea rows={3} className="input resize-none" value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                  </EditField>
                  <EditField label="Internal notes">
                    <textarea rows={2} className="input resize-none" value={editForm.internalNotes}
                      onChange={(e) => setEditForm({ ...editForm, internalNotes: e.target.value })} />
                  </EditField>
                  <style>{`.input { width: 100%; border-radius: 0.5rem; border: 1px solid #d6d3d1; padding: 0.5rem 0.75rem; font-size: 0.875rem; }
                  .input:focus { outline: none; border-color: #10b981; box-shadow: 0 0 0 1px #10b981; }`}</style>
                </div>
              )}
            </div>
          </div>

          {/* Right column - cost summary */}
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="mb-3 text-base font-semibold text-stone-900">Pricing</h2>
              <dl className="space-y-2 text-sm">
                <PriceRow label="Total cost" value={item.total_cost} bold />
                <PriceRow label="Markup" value={`${item.markup_percent || 0}%`} />
                <PriceRow label="Sale price" value={item.sale_price} highlight />
              </dl>
              {item.sold_at && (
                <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
                  Sold on {new Date(item.sold_at).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="mb-3 text-base font-semibold text-stone-900">Counts</h2>
              <ul className="space-y-1.5 text-sm text-stone-600">
                <li className="flex justify-between"><span>Files</span><span className="font-medium text-stone-900">{files.length}</span></li>
                <li className="flex justify-between"><span>Stones</span><span className="font-medium text-stone-900">{stones.length}</span></li>
                <li className="flex justify-between"><span>Metals</span><span className="font-medium text-stone-900">{metals.length}</span></li>
                <li className="flex justify-between"><span>Costs</span><span className="font-medium text-stone-900">{costs.length}</span></li>
              </ul>
            </div>

            <button
              onClick={handleDeleteItem}
              className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Delete jewelry item
            </button>
          </div>
        </div>
      )}

      {tab === "files" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-stone-900">Upload files</h2>
              <select
                value={defaultFileKind}
                onChange={(e) => setDefaultFileKind(e.target.value)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs"
              >
                {FILE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <FileUploader onUploaded={handleFileUploaded} />
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="mb-3 text-base font-semibold text-stone-900">Gallery</h2>
            <FilesGallery
              files={files}
              onDelete={handleFileDelete}
              onSetCover={handleSetCover}
              coverUrl={item.cover_image_url}
            />
          </div>
        </div>
      )}

      {tab === "stones" && <StonesPanel itemId={id} stones={stones} onChanged={load} />}
      {tab === "metals" && <MetalsPanel itemId={id} metals={metals} onChanged={load} />}
      {tab === "costs" && <CostsPanel itemId={id} costs={costs} item={item} onChanged={load} />}
      {tab === "history" && <HistoryTimeline history={history} />}

      <SellItemModal
        open={showSellModal}
        onClose={() => setShowSellModal(false)}
        item={item}
        onSold={load}
      />
    </div>
  );
};

const DetailField = ({ label, value, colSpan = 1 }) => (
  <div className={colSpan === 2 ? "col-span-2" : ""}>
    <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
    <dd className="mt-0.5 text-sm text-stone-800">{value || <span className="text-stone-300">—</span>}</dd>
  </div>
);

const EditField = ({ label, children }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-stone-700">{label}</label>
    {children}
  </div>
);

const PriceRow = ({ label, value, bold, highlight }) => {
  const formatted =
    typeof value === "number"
      ? `$${Number(value).toLocaleString()}`
      : value || <span className="text-stone-300">—</span>;
  return (
    <div className="flex items-center justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className={`${bold ? "font-semibold" : ""} ${highlight ? "text-emerald-700 text-base font-bold" : "text-stone-900"}`}>
        {formatted}
      </dd>
    </div>
  );
};

export default JewelryItemDetail;
