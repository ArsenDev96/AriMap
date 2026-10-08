"use client";

import { useEffect, useRef } from "react";
import { diagnosticTimings, diagnostics, type Timing } from "./diagnostics";

/** How far back the HUD's "recent" figures reach (ms): take a screenshot within this long after an action. */
const WINDOW_MS = 5000;
/** A frame this long (ms) or longer counts as a dropped/janky frame. */
const SLOW_FRAME_MS = 50;

/**
 * TEMPORARY (see diagnostics.ts): a small panel with frame times, long tasks, label-placement time and the
 * relief images on the page, shown with ?hud=1. It takes no pointer events, and updates its text twice a
 * second without rendering anything else.
 */
export function DiagnosticsHud() {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const started = performance.now();
    // Frame gaps from requestAnimationFrame: [end time, gap].
    const frames: [number, number][] = [];
    let worstFrame = 0;
    let slowFrames = 0;
    let last = 0;
    let raf = 0;
    const tick = (now: number) => {
      if (last) {
        const gap = now - last;
        frames.push([now, gap]);
        worstFrame = Math.max(worstFrame, gap);
        if (gap >= SLOW_FRAME_MS) slowFrames++;
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const longTasks: [number, number][] = [];
    let longTaskTotal = 0;
    let longTaskCount = 0;
    let observer: PerformanceObserver | null = null;
    const longTasksSupported = typeof PerformanceObserver !== "undefined" && (PerformanceObserver.supportedEntryTypes ?? []).includes("longtask");
    if (longTasksSupported) {
      observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          longTasks.push([e.startTime + e.duration, e.duration]);
          longTaskTotal += e.duration;
          longTaskCount++;
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    }

    const recentOf = (list: [number, number][], now: number) => {
      while (list.length && list[0][0] < now - WINDOW_MS) list.shift();
      return list;
    };
    const ms = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}ms`;
    const timingLine = (label: string, t: Timing, now: number) => {
      const recent = recentOf(t.recent, now);
      const recentTotal = recent.reduce((s, [, d]) => s + d, 0);
      const recentMax = recent.reduce((m, [, d]) => Math.max(m, d), 0);
      return `${label} 5s: ${recent.length}× ${ms(recentTotal)} max ${ms(recentMax)} | all: ${t.runs}× ${ms(t.totalMs)} max ${ms(t.maxMs)}`;
    };

    const d = diagnostics();
    const update = () => {
      const now = performance.now();
      const recentFrames = recentOf(frames, now);
      const span = recentFrames.reduce((s, [, g]) => s + g, 0);
      const fps = span > 0 ? (recentFrames.length * 1000) / span : 0;
      const recentWorst = recentFrames.reduce((m, [, g]) => Math.max(m, g), 0);
      const recentSlow = recentFrames.filter(([, g]) => g >= SLOW_FRAME_MS).length;
      const recentLong = recentOf(longTasks, now);
      const reliefImages = document.querySelectorAll("[data-relief] image");
      const reliefUrls = new Set([...reliefImages].map((i) => i.getAttribute("href")));
      const fetched = performance
        .getEntriesByType("resource")
        .filter((e) => /\/relief\/|-land\.|-tone\./.test(e.name)) as PerformanceResourceTiming[];
      const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
      el.textContent = [
        `relief ${d.relief ? "on" : "OFF"} · labels ${d.labels ? "on" : "OFF"} · save ${d.freeze ? "frozen" : "on"} · ${Math.round((now - started) / 1000)}s`,
        `frames 5s: ${fps.toFixed(0)}fps worst ${ms(recentWorst)} ≥50ms ${recentSlow} | all: worst ${ms(worstFrame)} ≥50ms ${slowFrames}`,
        longTasksSupported
          ? `long tasks 5s: ${recentLong.length}× ${ms(recentLong.reduce((s, [, t]) => s + t, 0))} | all: ${longTaskCount}× ${ms(longTaskTotal)}`
          : "long tasks: not reported by this browser",
        timingLine("place", diagnosticTimings.placement, now),
        timingLine("follow", diagnosticTimings.follow, now),
        `relief imgs ${reliefImages.length} (${reliefUrls.size} files, ${fetched.length} fetched)${heap ? ` · heap ${(heap / 1048576).toFixed(0)}MB` : ""}`,
      ].join("\n");
    };
    update();
    const interval = setInterval(update, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
      observer?.disconnect();
    };
  }, []);

  return (
    <pre
      ref={ref}
      aria-hidden="true"
      data-diagnostics-hud=""
      style={{
        position: "fixed",
        left: 4,
        bottom: "calc(4px + env(safe-area-inset-bottom))",
        zIndex: 2147483647,
        margin: 0,
        padding: "4px 6px",
        width: "min(340px, calc(100vw - 8px))",
        overflow: "hidden",
        font: "10px/1.3 ui-monospace, Menlo, Consolas, monospace",
        whiteSpace: "pre-wrap",
        color: "#fff",
        background: "rgba(0, 0, 0, 0.72)",
        borderRadius: 4,
        pointerEvents: "none",
        // Its own layer, so its text updates never repaint the map under it.
        willChange: "transform",
        contain: "layout paint",
      }}
    />
  );
}
