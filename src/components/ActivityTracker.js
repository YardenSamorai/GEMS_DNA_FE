import { useEffect } from "react";
import { useTeam } from "../context/TeamContext";
import { sendHeartbeat } from "../services/activityApi";
import {
  setActivityActor,
  trackSessionStart,
  trackSessionEnd,
  flushActivity,
} from "../utils/activityLog";

/* Invisible mount inside the signed-in shell. Wires the current actor into the
 * activity logger, records a session_start, keeps a presence heartbeat going
 * (so the manager's Team activity view can show "online now"), and flushes any
 * queued events when the tab is hidden or closed. */
const HEARTBEAT_MS = 60000;

const ActivityTracker = () => {
  const { actor, ready } = useTeam();
  const actorId = actor?.id || null;

  useEffect(() => {
    setActivityActor(actor);
    if (!ready || !actorId) return undefined;

    trackSessionStart();
    sendHeartbeat(actor);

    const hb = setInterval(() => sendHeartbeat(actor), HEARTBEAT_MS);

    const onHide = () => {
      trackSessionEnd(); // records duration, then flushes
      flushActivity();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushActivity();
      else sendHeartbeat(actor);
    };

    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(hb);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flushActivity();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, ready]);

  return null;
};

export default ActivityTracker;
