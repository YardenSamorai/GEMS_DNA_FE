// Critically damped by default: nothing overshoots unless a gesture handed
// it momentum. Exits share the enter curve but run shorter.
export const SPRING = { type: "spring", bounce: 0, duration: 0.4 };
export const SPRING_EXIT = { type: "spring", bounce: 0, duration: 0.28 };
export const SPRING_RELEASE = { type: "spring", bounce: 0.15, duration: 0.45 };
export const EASE_OUT = [0.25, 1, 0.5, 1];
export const FADE = { duration: 0.2, ease: EASE_OUT };
export const FADE_FAST = { duration: 0.16, ease: EASE_OUT };

// Distance or flick speed that commits a drag-to-dismiss.
export const DISMISS_OFFSET = 120;
export const DISMISS_VELOCITY = 550;

export const shouldDismiss = (info) =>
  Math.abs(info.offset.y) > DISMISS_OFFSET || Math.abs(info.velocity.y) > DISMISS_VELOCITY;
