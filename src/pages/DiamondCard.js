import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { decryptPrice } from "../utils/decrypt";
import { encryptPrice } from "../utils/helper";
import { barakURL } from "../utils/const";
import { readPriceMode, scaleInventoryPrice } from "../utils/pricing";
import toast from 'react-hot-toast';
import InterestedModal from '../components/InterestedModal';
import StoneUsagePanel from '../components/StoneUsagePanel';
import SetDnaView from '../components/SetDnaView';
import GemstoneDnaPage from './dna/GemstoneDnaPage';
import DnaPairPage from './dna/DnaPairPage';
import { orderPair, pairPriceCodes } from './dna/pairModel';
import { DnaNotFound, DnaSkeleton } from './dna/DnaStates';
import { certificateUrl } from './dna/dnaModel';

// API base URL from .env
const API_BASE = process.env.REACT_APP_API_URL || 'https://gems-dna-be.onrender.com';

const DiamondCard = () => {
  const { stone_id } = useParams();
  const navigate = useNavigate();
  // ?single=1 is how the pair screen links through to one stone on its own.
  const [searchParams] = useSearchParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interestedOpen, setInterestedOpen] = useState(false);
  /* Around 3.5% of the stones that claim a photo name a file the supplier
   * never uploaded, and the page has no way to know until the load fails.
   * Without this the visitor gets a torn-page icon on a public product page. */
  const [photoFailed, setPhotoFailed] = useState(false);
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

  const [loadedFor, setLoadedFor] = useState(null);

  useEffect(() => {
    if (!stone_id) return;

    let stale = false;
    setPhotoFailed(false);
    fetch(`${API_BASE}/api/stones/${stone_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (stale) return;
        setDetails(data);
        setLoadedFor(stone_id);
        setLoading(false);
      })
      .catch((err) => {
        if (stale) return;
        console.error("❌ Error fetching stone:", err);
        setLoadedFor(stone_id);
        setLoading(false);
      });
    return () => { stale = true; };
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

  // Takes the URL explicitly so the pair screen can fall back to whichever of
  // the two stones actually has a video.
  const shareVideoUrl = async (videoUrl) => {
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

  const handleShareVideo = () => shareVideoUrl(details?.video);

  // Moving to the other half of a pair renders at once from the record already
  // here; any other SKU waits for its own record rather than showing this one.
  const onScreen = details && (details.stone_id === stone_id || details.pair?.stone_id === stone_id);
  if (loading || (loadedFor !== stone_id && !onScreen)) return <DnaSkeleton />;

  // A 404 still parses as JSON ({ error }), so "no stone_id" is the real miss.
  if (!details || !details.stone_id) {
    return <DnaNotFound onBack={isSignedIn ? goBack : null} />;
  }

  /* A set is one record describing a whole lot, so its weight and price mean
     something entirely different from a single stone's. Rendered here first,
     because the plain view below would present a 27-stone, 164 ct lot as one
     impossibly large emerald. */
  if (details.set) {
    return (
      <>
        <SetDnaView
          stone={details}
          set={details.set}
          isSignedIn={isSignedIn}
          barakURL={barakURL}
          onBack={goBack}
          onInterested={() => setInterestedOpen(true)}
          onShare={handleShare}
          onShareVideo={handleShareVideo}
        />
        <InterestedModal
          open={interestedOpen}
          onClose={() => setInterestedOpen(false)}
          sku={details.stone_id}
          snapshot={{
            sku: details.stone_id,
            isSet: true,
            stones: details.set.stones,
            category: details.category,
            shape: details.shape,
            weightCt: Number(details.set.total_carat) || Number(details.carat) || 0,
            color: details.color,
            clarity: details.clarity,
            lab: details.lab,
            certificateNumber: details.certificate_number,
            image: details.picture,
          }}
        />
      </>
    );
  }

  // Neto/Bruto preference is set on the inventory screen and mirrored here via
  // localStorage. Scaling itself lives in utils/pricing.js so this page can
  // never drift from the inventory. A scaled-up figure gets a "B" prefix.
  const priceMode = readPriceMode();

  const priceCodeFor = (encryptedValue, stone = details) => {
    const full = decryptPrice(encryptedValue);
    const scaled = scaleInventoryPrice(full, stone, priceMode);
    if (scaled !== full) {
      const code = encryptPrice(scaled);
      return code === "N/A" ? code : `B${code}`;
    }
    return encryptPrice(full);
  };

  /* A stone the API confirmed has a genuine partner opens as the pair, since
     that is how a matched pair is sold. ?single=1 is the way to one stone on
     its own. All three views come from this one record, so moving between
     them is instant; the URL still changes so each view stays shareable. */
  if (details.pair) {
    const pairStones = [details, details.pair];
    const [first] = orderPair(details, details.pair);
    const singleSku = searchParams.get("single") === "1" ? stone_id : null;
    const viewed = pairStones.find((s) => s.stone_id === singleSku) || null;
    const pairVideo = details.video || details.pair.video;

    return (
      <>
        <DnaPairPage
          a={details}
          b={details.pair}
          view={viewed ? viewed.stone_id : "pair"}
          onSelect={(key) => navigate(key === "pair" ? `/${first.stone_id}` : `/${key}?single=1`, { state: { quietTransition: true } })}
          isSignedIn={isSignedIn}
          certUrlFor={(s) => certificateUrl(s, barakURL)}
          pairPrices={isSignedIn ? pairPriceCodes(details, details.pair) : null}
          pricesFor={isSignedIn ? (s) => ({
            perCarat: priceCodeFor(s.price_per_carat, s),
            total: priceCodeFor(s.total_price, s),
          }) : null}
          onBack={goBack}
          onInterested={() => setInterestedOpen(true)}
          onShare={handleShare}
          pairShareVideo={pairVideo ? () => shareVideoUrl(pairVideo) : null}
          shareVideoFor={(s) => (s.video ? () => shareVideoUrl(s.video) : null)}
          staffPanelFor={isSignedIn ? (s) => <StoneUsagePanel sku={s.stone_id} /> : null}
        />
        <InterestedModal
          open={interestedOpen}
          onClose={() => setInterestedOpen(false)}
          sku={viewed ? viewed.stone_id : details.stone_id}
          snapshot={viewed ? {
            sku: viewed.stone_id,
            category: viewed.category,
            shape: viewed.shape,
            weightCt: Number(viewed.carat) || 0,
            color: viewed.color,
            clarity: viewed.clarity,
            lab: viewed.lab,
            certificateNumber: viewed.certificate_number,
            image: viewed.picture,
          } : {
            sku: details.stone_id,
            pairSku: details.pair.stone_id,
            isPair: true,
            category: details.category,
            shape: details.shape,
            weightCt: (Number(details.carat) || 0) + (Number(details.pair.carat) || 0),
            color: details.color,
            clarity: details.clarity,
            lab: details.lab,
            certificateNumber: details.certificate_number,
            image: details.picture,
          }}
        />
      </>
    );
  }

  return (
    <>
      <GemstoneDnaPage
        stone={details}
        isSignedIn={isSignedIn}
        certUrl={certificateUrl(details, barakURL)}
        prices={isSignedIn ? {
          perCarat: priceCodeFor(details.price_per_carat),
          total: priceCodeFor(details.total_price),
        } : null}
        photoFailed={photoFailed}
        onPhotoError={() => setPhotoFailed(true)}
        onBack={goBack}
        onInterested={() => setInterestedOpen(true)}
        onShare={handleShare}
        onShareVideo={details.video ? handleShareVideo : null}
        staffPanel={isSignedIn ? <StoneUsagePanel sku={details.stone_id} /> : null}
      />
      <InterestedModal
        open={interestedOpen}
        onClose={() => setInterestedOpen(false)}
        sku={details.stone_id}
        snapshot={{
          sku: details.stone_id,
          category: details.category,
          shape: details.shape,
          weightCt: Number(details.carat) || 0,
          color: details.color,
          clarity: details.clarity,
          lab: details.lab,
          certificateNumber: details.certificate_number,
          image: details.picture,
        }}
      />
    </>
  );
};

export default DiamondCard;

