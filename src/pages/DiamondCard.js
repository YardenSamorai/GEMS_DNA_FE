import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { decryptPrice } from "../utils/decrypt";
import { changeMeasurementsFormat, encryptPrice } from "../utils/helper";
import { barakURL } from "../utils/const";
import { getMappedCategories } from "../utils/categoryMap";
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import InterestedModal from '../components/InterestedModal';
import StoneUsagePanel from '../components/StoneUsagePanel';
import { Skeleton, SkeletonText } from '../components/ui/Skeleton';

// API base URL from .env
const API_BASE = process.env.REACT_APP_API_URL || 'https://gems-dna-be.onrender.com';

const DiamondCard = () => {
  const { stone_id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [interestedOpen, setInterestedOpen] = useState(false);
  const { isSignedIn } = useUser();

  // Back to wherever the rep came from (their filtered inventory list). Inside
  // the PWA there's no browser chrome, so this is the only way back. Fall back
  // to the inventory route when there's no in-app history to pop.
  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/inventory");
    }
  };

  const isEmerald = () => {
    return getMappedCategories(details?.category).includes('Emerald');
  };

  const isDiamond = () => {
    return getMappedCategories(details?.category).includes('Diamond');
  };

  const isFancy = () => false;

  useEffect(() => {
    if (!stone_id) return;

    fetch(`${API_BASE}/api/stones/${stone_id}`)
      .then((res) => res.json())
      .then((data) => {
        setDetails(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Error fetching stone:", err);
        setLoading(false);
      });
  }, [stone_id]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Check out this gem!', text: 'View the full DNA of this gemstone:', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      toast.error('Sharing canceled or failed.');
    }
  };

  const handleShareVideo = async () => {
    const videoUrl = details?.video;
    if (!videoUrl) return toast.error('No video available to share.');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Gemstone Video', text: 'Check out this gemstone video:', url: videoUrl });
      } else {
        await navigator.clipboard.writeText(videoUrl);
        toast.success('Video link copied to clipboard!');
      }
    } catch (error) {
      toast.error('Sharing canceled or failed.');
    }
  };

  if (loading) {
    // Mirror the public stone DNA layout: large media on the left, info
    // panel on the right with title, badge row, key/value table, and a
    // CTA strip at the bottom.
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
              ))}
            </div>
            <SkeletonText lines={3} />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-11 flex-1 rounded-xl" />
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="glass-surface rounded-3xl px-8 py-10 max-w-md w-full text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-app-surface/60 border border-white/55 backdrop-blur-md flex items-center justify-center">
            <svg className="w-6 h-6 text-app-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-app-ink">Stone not found</h2>
          <p className="text-[13.5px] text-app-muted mt-2 leading-relaxed">
            The stone you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  // Neto/Bruto preference is set on the inventory screen and mirrored here via
  // localStorage. Diamonds have no Bruto/Neto split — they're always Neto (no
  // "B" prefix). Gemstones/emeralds follow the preference:
  //   Neto  → price / 2, no "B" prefix
  //   Bruto → full price, "B" prefix
  const priceMode = (() => {
    try {
      return localStorage.getItem("gems_price_mode") === "bruto" ? "bruto" : "neto";
    } catch {
      return "neto";
    }
  })();

  const priceCodeFor = (encryptedValue) => {
    const full = decryptPrice(encryptedValue);
    if (isDiamond()) return encryptPrice(full / 2);
    if (priceMode === "bruto") {
      const code = encryptPrice(full);
      return code === "N/A" ? code : `B${code}`;
    }
    return encryptPrice(full / 2);
  };

  const certUrl = details.certificate_url
    || (details.certificate_number ? `${barakURL}/${details.certificate_number}.pdf` : null);

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {isSignedIn && (
          <button
            onClick={goBack}
            className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-surface text-app-graphite text-sm font-medium hover:bg-app-surface/85 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        {/* Header Card — v1.0.5 glass shell. The legacy emerald-gradient title
            bar is replaced by an ink-tone editorial header: lab badge, copyable
            SKU, large display title, and a discreet price slot for signed-in
            staff. No saturated chrome — the flagship public surface for the
            brand. */}
        <div className="rounded-3xl glass-surface-strong overflow-hidden mb-6">
          <div className="px-6 py-6 sm:px-10 sm:py-8 border-b border-app-line">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-surface text-[11px] font-medium tracking-[0.08em] uppercase text-app-graphite">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />
                    {details.lab}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(details.stone_id);
                      toast.success('SKU copied!', { duration: 1500, style: { fontSize: '13px' } });
                    }}
                    className="inline-flex items-center gap-1.5 text-app-muted text-[11.5px] hover:text-app-ink transition-colors group cursor-pointer"
                    title="Click to copy SKU"
                  >
                    <span className="tracking-[0.04em]">ID · {details.stone_id}</span>
                    <svg className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <h1 className="text-[28px] sm:text-[38px] font-semibold tracking-tight text-app-ink leading-tight">
                  {details.shape} · {details.carat} ct
                  {(isDiamond() || isFancy()) && details.clarity ? (
                    <span className="text-app-graphite"> · {details.clarity}</span>
                  ) : null}
                </h1>
              </div>
              {isSignedIn && (
                <div className="flex flex-col items-start sm:items-end shrink-0">
                  <span className="text-app-soft text-[10.5px] font-medium uppercase tracking-[0.14em] mb-1">
                    Total price
                  </span>
                  <span className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-app-ink">
                    {priceCodeFor(details.total_price)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="relative rounded-2xl overflow-hidden bg-app-canvas-2 aspect-square">
                  {details.video ? (
                    <iframe 
                      className="w-full h-full absolute inset-0" 
                      src={details.video} 
                      title="Video Preview" 
                      allowFullScreen
                    ></iframe>
                  ) : (
                    <img 
                      src={details.picture || "https://app.barakdiamonds.com/Gemstones/Output/StoneImages/Eshed_no_image_2.jpg"} 
                      alt="Stone"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {details.picture && (
                    <div className="relative group">
                      <div className="rounded-xl overflow-hidden bg-app-canvas-2 aspect-square">
                        <img
                          src={details.picture}
                          alt="Stone"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="absolute bottom-2 left-2 text-[10.5px] font-medium tracking-[0.08em] uppercase text-white bg-black/55 backdrop-blur-md px-2 py-0.5 rounded-full">
                        Photo
                      </span>
                    </div>
                  )}
                  {certUrl && (
                    <a
                      href={certUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative group"
                    >
                      <div className="rounded-xl overflow-hidden bg-app-canvas-2 aspect-square ring-1 ring-app-line group-hover:ring-app-line2 transition">
                        <embed
                          src={certUrl}
                          type="application/pdf"
                          className="w-full h-full pointer-events-none"
                        />
                      </div>
                      <span className="absolute bottom-2 left-2 text-[10.5px] font-medium tracking-[0.08em] uppercase text-white bg-black/55 backdrop-blur-md px-2 py-0.5 rounded-full">
                        Certificate
                      </span>
                      <div className="absolute inset-0 bg-app-ink/0 group-hover:bg-app-ink/10 transition-colors rounded-xl flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity btn-primary">
                          View PDF
                        </span>
                      </div>
                    </a>
                  )}
                </div>
              </div>

              {/* Right - Details */}
              <div className="space-y-6">
                {/* Tabs — segmented glass control */}
                <div className="inline-flex gap-1 p-1 rounded-full glass-surface w-full">
                  <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>
                    Details
                  </TabButton>
                  <TabButton active={activeTab === 'specs'} onClick={() => setActiveTab('specs')}>
                    Specifications
                  </TabButton>
                </div>

                {/* Tab Content */}
                {activeTab === 'details' && (
                  <motion.div 
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Common fields for all stones */}
                    <DetailCard icon="💎" title="Shape" value={details.shape} />
                    <DetailCard icon="⚖️" title="Carat Weight" value={`${details.carat} ct`} />
                    
                    {/* Diamond & Fancy specific: Color */}
                    {(isDiamond() || isFancy()) && details.color && (
                      <DetailCard icon="🎨" title="Color" value={details.color} />
                    )}
                    
                    {/* Diamond & Fancy specific: Clarity */}
                    {(isDiamond() || isFancy()) && (
                      <DetailCard icon="✨" title="Clarity" value={details.clarity} />
                    )}
                    
                    {/* Common: Lab */}
                    <DetailCard icon="🏛️" title="Lab" value={details.lab} />
                    
                    {/* Diamond & Fancy specific: Fluorescence */}
                    {(isDiamond() || isFancy()) && details.fluorescence && (
                      <DetailCard icon="💡" title="Fluorescence" value={details.fluorescence} />
                    )}
                    
                    {/* Common: Origin */}
                    <DetailCard icon="🌍" title="Origin" value={details.origin} />
                    
                    {/* Emerald specific: Treatment */}
                    {isEmerald() && details.treatment && (
                      <DetailCard icon="💧" title="Treatment" value={details.treatment} />
                    )}
                    
                    {/* Common: Ratio & Measurements */}
                    <DetailCard icon="📐" title="Ratio" value={details.ratio} />
                    <DetailCard icon="📏" title="Measurements" value={changeMeasurementsFormat(details.measurements1)} />
                    
                    {/* Location - only for signed-in users */}
                    {isSignedIn && details.location && (
                      <DetailCard icon="📍" title="Location" value={details.location} />
                    )}
                    
                    {/* Diamond & Fancy specific: Cut, Polish, Symmetry */}
                    {(isDiamond() || isFancy()) && (
                      <>
                        {details.cut && <DetailCard icon="✂️" title="Cut" value={details.cut} />}
                        {details.polish && <DetailCard icon="✨" title="Polish" value={details.polish} />}
                        {details.symmetry && <DetailCard icon="⚖️" title="Symmetry" value={details.symmetry} />}
                        {details.table_percent && <DetailCard icon="📊" title="Table %" value={`${details.table_percent}%`} />}
                        {details.depth_percent && <DetailCard icon="📏" title="Depth %" value={`${details.depth_percent}%`} />}
                        {details.rap_price !== null && details.rap_price !== undefined && (
                          <DetailCard icon="💰" title="Rap %" value={`${details.rap_price}%`} />
                        )}
                      </>
                    )}
                    
                    {/* Fancy specific: Fancy Color details */}
                    {isFancy() && (
                      <>
                        {details.fancy_intensity && <DetailCard icon="🌈" title="Fancy Intensity" value={details.fancy_intensity} />}
                        {details.fancy_color && <DetailCard icon="🎨" title="Fancy Color" value={details.fancy_color} />}
                        {details.fancy_overtone && <DetailCard icon="✨" title="Overtone" value={details.fancy_overtone} />}
                        {details.fancy_color_2 && <DetailCard icon="🎨" title="Secondary Color" value={details.fancy_color_2} />}
                        {details.fancy_overtone_2 && <DetailCard icon="✨" title="Secondary Overtone" value={details.fancy_overtone_2} />}
                      </>
                    )}
                    
                    {details.pair_stone && (
                      <div className="flex items-center justify-between p-4 rounded-2xl glass-surface">
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-app-line2" />
                          <span className="text-app-graphite font-medium text-[13.5px]">Pair stone</span>
                        </div>
                        <Link
                          to={`/${details.pair_stone}`}
                          className="text-app-ink hover:underline font-medium text-[13.5px] flex items-center gap-1"
                        >
                          {details.pair_stone}
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </Link>
                      </div>
                    )}

                    {isSignedIn && (
                      <div className="mt-6 p-4 rounded-2xl glass-surface">
                        <div className="flex items-center justify-between">
                          <span className="text-app-muted font-medium text-[12.5px]">Price per carat</span>
                          <span className="text-[16px] font-semibold tracking-tight text-app-ink">
                            {priceCodeFor(details.price_per_carat)}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'specs' && (
                  <motion.div 
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <DetailCard icon="🔢" title="Stone ID" value={details.stone_id} />
                    {details.category && <DetailCard icon="📁" title="Category" value={getMappedCategories(details.category).join(', ')} />}
                    <DetailCard
                      icon="📜"
                      title="Certificate #"
                      value={
                        details.certificate_number ? (
                          <a
                            href={certUrl || '#'}
                            className="text-app-ink hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {details.certificate_number}
                          </a>
                        ) : 'N/A'
                      }
                    />
                    <DetailCard icon="📏" title="Measurements" value={changeMeasurementsFormat(details.measurements1)} />
                    
                    {/* Emerald specific: Treatment in specs */}
                    {isEmerald() && details.treatment && (
                      <DetailCard icon="💧" title="Treatment" value={details.treatment} />
                    )}
                    
                    {/* Diamond & Fancy specific technical specs */}
                    {(isDiamond() || isFancy()) && (
                      <>
                        {details.cut && <DetailCard icon="✂️" title="Cut" value={details.cut} />}
                        {details.polish && <DetailCard icon="✨" title="Polish" value={details.polish} />}
                        {details.symmetry && <DetailCard icon="⚖️" title="Symmetry" value={details.symmetry} />}
                        {details.table_percent && <DetailCard icon="📊" title="Table %" value={`${details.table_percent}%`} />}
                        {details.depth_percent && <DetailCard icon="📏" title="Depth %" value={`${details.depth_percent}%`} />}
                        {details.fluorescence && <DetailCard icon="💡" title="Fluorescence" value={details.fluorescence} />}
                        {details.rap_price !== null && details.rap_price !== undefined && (
                          <DetailCard icon="💰" title="Rap %" value={`${details.rap_price}%`} />
                        )}
                      </>
                    )}
                    
                    {/* Fancy specific: Fancy Color details in specs */}
                    {isFancy() && (
                      <>
                        {details.fancy_intensity && <DetailCard icon="🌈" title="Fancy Intensity" value={details.fancy_intensity} />}
                        {details.fancy_color && <DetailCard icon="🎨" title="Fancy Color" value={details.fancy_color} />}
                        {details.fancy_overtone && <DetailCard icon="✨" title="Overtone" value={details.fancy_overtone} />}
                      </>
                    )}
                  </motion.div>
                )}

                {/* Action buttons — primary ink CTA, glass secondaries */}
                <div className="pt-6 border-t border-app-line space-y-3">
                  <button
                    type="button"
                    onClick={() => setInterestedOpen(true)}
                    className="btn-primary w-full py-3 text-[14px]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                    </svg>
                    I'm interested
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleShare} className="btn-secondary">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share DNA
                    </button>
                    <button onClick={handleShareVideo} className="btn-secondary">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Share video
                    </button>
                  </div>
                </div>

                <InterestedModal
                  open={interestedOpen}
                  onClose={() => setInterestedOpen(false)}
                  sku={details.stone_id}
                  snapshot={{
                    sku: details.stone_id,
                    category: details.category,
                    shape: details.shape,
                    weightCt: details.weight,
                    color: details.color,
                    clarity: details.clarity,
                    lab: details.lab,
                    certificateNumber: details.certificate_number,
                    image: details.image_url,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Staff-only cross-system usage panel: where this stone lives across
            workshop jewelry, deals, and DNA inquiries. Hidden from public visitors. */}
        {isSignedIn && details?.stone_id && (
          <div className="mt-6">
            <StoneUsagePanel sku={details.stone_id} />
          </div>
        )}
      </motion.div>
    </div>
  );
};

const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-1.5 px-4 rounded-full text-[12.5px] font-medium transition-colors ${
      active
        ? 'bg-app-ink text-app-canvas shadow-[0_4px_14px_-6px_rgba(0,0,0,0.45)]'
        : 'text-app-graphite hover:text-app-ink'
    }`}
  >
    {children}
  </button>
);

const DetailCard = ({ icon, title, value }) => (
  <div className="flex items-center justify-between p-4 rounded-2xl bg-app-surface/55 border border-white/55 backdrop-blur-md hover:bg-app-surface/75 transition-colors">
    <div className="flex items-center gap-3 min-w-0">
      <span className="text-[16px] opacity-70">{icon}</span>
      <span className="text-app-muted font-medium text-[12.5px] truncate">{title}</span>
    </div>
    <span className="text-app-ink font-medium text-[13px] truncate ml-3 text-right">{value || 'N/A'}</span>
  </div>
);

export default DiamondCard;
