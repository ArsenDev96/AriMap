"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch } from "react";
import type { CountryId } from "@/core/content/types";
import { buildMapView } from "@/core/lesson/mapView";
import type { LessonAction, LessonProgress } from "@/core/lesson/progress";
import type { LessonDefinition } from "@/core/lessons/types";
import type { AppAction } from "@/core/progress/appState";
import { Header } from "./Header";
import { RegionMap } from "./map/RegionMap";
import { DiscoverPanel } from "./panels/DiscoverPanel";
import { FindPanel, FindSummaryPanel } from "./panels/FindPanels";
import { ResultsPanel } from "./panels/ResultsPanel";
import { TravelPanel } from "./panels/TravelPanel";
import styles from "./LessonScreen.module.css";

const TRAVEL_HINT_MS = 6000;

interface Props {
  lesson: LessonDefinition;
  progress: LessonProgress;
  dispatch: Dispatch<AppAction>;
}

export interface PanelProps {
  lesson: LessonDefinition;
  progress: LessonProgress;
  act: (action: LessonAction) => void;
  dispatch: Dispatch<AppAction>;
}

export function LessonScreen({ lesson, progress, dispatch }: Props) {
  const act = (action: LessonAction) => dispatch({ type: "lesson", action });

  // Travel hint labels are transient UI state: shown for a few seconds and only
  // for the position where the hint was requested. The "hint used" flag itself
  // is saved in the attempt.
  const [travelHint, setTravelHint] = useState<{ at: number } | null>(null);
  const pathLength = progress.travel?.path.length ?? 0;
  const travelHintVisible = progress.stage === "travel" && travelHint?.at === pathLength;
  useEffect(() => {
    if (!travelHint) return;
    const timer = window.setTimeout(() => setTravelHint(null), TRAVEL_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [travelHint]);

  // A newly chosen Discover country starts at the top of its card, not at the
  // previous card's scroll position (on phones the panel scrolls).
  const panelRef = useRef<HTMLElement>(null);
  const discoverSelected = progress.stage === "discover" ? progress.discover.selected : null;
  useLayoutEffect(() => {
    if (discoverSelected) panelRef.current?.scrollTo({ top: 0 });
  }, [discoverSelected]);

  const view = useMemo(() => buildMapView(lesson, progress, { travelHintVisible }), [lesson, progress, travelHintVisible]);

  const onCountryTap = (country: CountryId) => {
    if (progress.stage === "discover") {
      if (lesson.countries.includes(country)) act({ type: "discoverSelect", country });
    } else if (progress.stage === "find") {
      act({ type: "findGuess", country });
    }
  };

  const panelProps: PanelProps = { lesson, progress, act, dispatch };

  return (
    <div className={styles.screen}>
      <Header progress={progress} dispatch={dispatch} />
      <main className={styles.main}>
        <div className={styles.mapArea}>
          <RegionMap lesson={lesson} view={view} stage={progress.stage} onCountryTap={onCountryTap} />
        </div>
        <section ref={panelRef} className={styles.panel} data-testid="panel">
          {progress.stage === "discover" && <DiscoverPanel {...panelProps} />}
          {progress.stage === "find" && <FindPanel {...panelProps} />}
          {progress.stage === "findSummary" && <FindSummaryPanel {...panelProps} />}
          {progress.stage === "travel" && (
            <TravelPanel
              {...panelProps}
              hintVisible={travelHintVisible}
              onHint={() => {
                act({ type: "travelHint" });
                setTravelHint({ at: pathLength });
              }}
            />
          )}
          {progress.stage === "results" && <ResultsPanel {...panelProps} />}
        </section>
      </main>
    </div>
  );
}
