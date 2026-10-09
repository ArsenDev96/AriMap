"use client";

import { useRef, type PointerEvent } from "react";

/** Movement (px) beyond which a press becomes a drag, not a tap. */
const TAP_SLOP = 10;
const TAP_MAX_MS = 700;

function countryAt(target: EventTarget | null): string | null {
  const el = target instanceof Element ? target.closest("[data-country]") : null;
  return el?.getAttribute("data-country") ?? null;
}

/**
 * Distinguishes a deliberate tap on a country from pan/pinch gestures.
 * A selection fires only for a single pointer that went down and up on the
 * same country without moving more than a few pixels, so dragging or pinching
 * the map never submits an answer.
 */
export function useCountryTap(onTap: ((country: string) => void) | undefined) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ country: string | null; x: number; y: number; time: number; cancelled: boolean } | null>(null);

  const reset = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
  };

  return {
    onPointerDown(e: PointerEvent) {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 1) {
        gesture.current = { country: countryAt(e.target), x: e.clientX, y: e.clientY, time: e.timeStamp, cancelled: false };
      } else if (gesture.current) {
        gesture.current.cancelled = true; // multi-touch = pinch
      }
    },
    onPointerMove(e: PointerEvent) {
      const g = gesture.current;
      if (!g || Math.hypot(e.clientX - g.x, e.clientY - g.y) <= TAP_SLOP) return;
      // A mouse press that becomes a drag: the map takes the mouse until it is released, so the
      // browser stops looking for the shape under it on every move (most of a drag's work in
      // Chrome and Firefox otherwise). Touch is held by the element first touched anyway.
      if (!g.cancelled && e.pointerType === "mouse" && e.buttons) e.currentTarget.setPointerCapture(e.pointerId);
      g.cancelled = true;
    },
    onPointerUp(e: PointerEvent) {
      const g = gesture.current;
      const single = pointers.current.size === 1;
      reset(e);
      if (!g || !single || g.cancelled || !onTap) return;
      if (e.timeStamp - g.time > TAP_MAX_MS) return;
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > TAP_SLOP) return;
      const country = countryAt(e.target);
      if (country && country === g.country) onTap(country);
    },
    onPointerCancel: reset,
    onPointerLeave(e: PointerEvent) {
      if (e.pointerType === "mouse") reset(e);
    },
  };
}
