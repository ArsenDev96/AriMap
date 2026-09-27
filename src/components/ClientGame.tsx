"use client";

import dynamic from "next/dynamic";

// The game reads saved progress from localStorage on first render, so it is
// rendered on the client only. The server sends a small language-aware splash.
const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => (
    <div className="splash" aria-busy="true">
      <title>AriMap — Discover the world.</title>
      <span className="splash-en">AriMap</span>
      <span className="splash-hy" lang="hy">
        ԱրիՄապ
      </span>
    </div>
  ),
});

export function ClientGame() {
  return <Game />;
}
