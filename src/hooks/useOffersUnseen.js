import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchOffers } from "../services/offersApi";

/* Badge driver for the sidebar "Offers" item.
 *
 * Counts buyer responses across the salesperson's offers and subtracts what
 * they've already seen (persisted in localStorage). The remainder is the red
 * notification count. Visiting the Offers page calls markOffersSeen() to clear
 * it. Polls every 60s and on window focus so new responses surface without a
 * reload. */

const SEEN_KEY = "offers.lastSeenResponseTotal";
const SEEN_EVENT = "offers-seen";

const readSeen = () => {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
};

// Called by the Offers page once it has the current total. Persists it as the
// "seen" baseline and notifies any mounted sidebar to drop its badge.
export const markOffersSeen = (total) => {
  try {
    localStorage.setItem(SEEN_KEY, String(Math.max(0, Number(total) || 0)));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(SEEN_EVENT));
  } catch {}
};

export default function useOffersUnseen() {
  const { user } = useUser();
  const userId = user?.id;
  const [total, setTotal] = useState(0);
  const [seen, setSeen] = useState(readSeen);

  const refresh = useCallback(() => {
    if (!userId) return;
    fetchOffers(userId)
      .then((res) => {
        const t = (res.offers || []).reduce(
          (a, b) => a + (Number(b.response_count) || 0),
          0
        );
        setTotal(t);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(refresh, 60000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // Re-read the seen baseline whenever the Offers page marks things seen, and
  // optimistically clear the badge to the just-seen total.
  useEffect(() => {
    const onSeen = () => setSeen(readSeen());
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => window.removeEventListener(SEEN_EVENT, onSeen);
  }, []);

  return Math.max(0, total - seen);
}
