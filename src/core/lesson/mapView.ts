import { getCountry } from "../content/countries";
import type { CountryId, LonLat } from "../content/types";
import { neighborsOf } from "../game/graph";
import { currentCountry } from "../game/travel";
import type { LessonDefinition } from "../lessons/types";
import type { LessonProgress } from "./progress";

/**
 * Visual role of an active country. Renderers map tones to colours;
 * active countries without an entry use "default".
 */
export type CountryTone =
  | "default"
  | "selected"
  | "correct"
  | "wrong"
  | "reveal"
  | "visited"
  | "current"
  | "destination";

export interface MapMarker {
  kind: "capital" | "landmark" | "current";
  country: CountryId;
  coordinates: LonLat;
}

export interface MapView {
  tones: Partial<Record<CountryId, CountryTone>>;
  /** Active countries whose names are drawn on the map. */
  labels: CountryId[];
  markers: MapMarker[];
  /** Countries joined by the route line, in order. */
  route: CountryId[];
  /** Country whose surrounding area is circled as a hint. */
  areaHint: CountryId | null;
  /** Whether tapping countries submits a selection/answer. */
  interactive: boolean;
  /** Whether active countries may expose their names to assistive technology. */
  namesPublic: boolean;
  /** Discover only: countries already explored, marked beside their names. */
  explored: CountryId[];
  /**
   * Find only: the latest answer, for brief on-map feedback. `key` changes with
   * every tap, so each answer is emphasised once.
   */
  feedback: { country: CountryId; kind: "correct" | "wrong"; key: string } | null;
  /** Travel: the journey has reached its destination. */
  arrived: boolean;
}

export interface MapUiState {
  /** Travel hint: neighbour names are shown temporarily. */
  travelHintVisible: boolean;
}

const EMPTY: MapView = {
  tones: {},
  labels: [],
  markers: [],
  route: [],
  areaHint: null,
  interactive: false,
  namesPublic: false,
  explored: [],
  feedback: null,
  arrived: false,
};

export function buildMapView(lesson: LessonDefinition, progress: LessonProgress, ui: MapUiState): MapView {
  switch (progress.stage) {
    case "discover": {
      const selected = progress.discover.selected;
      const markers: MapMarker[] = [];
      if (selected) {
        const c = getCountry(selected);
        markers.push({ kind: "capital", country: selected, coordinates: c.capital.coordinates });
        if (c.landmark?.coordinates) markers.push({ kind: "landmark", country: selected, coordinates: c.landmark.coordinates });
      }
      return {
        ...EMPTY,
        tones: selected ? { [selected]: "selected" } : {},
        labels: [...lesson.countries],
        markers,
        interactive: true,
        namesPublic: true,
        explored: [...progress.discover.explored],
      };
    }

    case "find": {
      const q = progress.find?.question;
      if (!q) return EMPTY;
      const tones: MapView["tones"] = {};
      const labels: CountryId[] = [];
      // Only the latest tap is identified; everything resets with the next question.
      if (q.feedback?.kind === "wrong") {
        tones[q.feedback.country] = "wrong";
        labels.push(q.feedback.country);
      }
      if (q.solved) {
        tones[q.target] = "correct";
        labels.push(q.target);
      } else if (q.hintLevel >= 3) {
        tones[q.target] = "reveal";
      }
      const session = progress.find;
      const key = `${session?.index}.${q.wrongGuesses.length}.${q.solved}`;
      const feedback: MapView["feedback"] =
        q.feedback?.kind === "correct" || q.feedback?.kind === "wrong" ? { country: q.feedback.country, kind: q.feedback.kind, key } : null;
      return {
        ...EMPTY,
        tones,
        labels,
        areaHint: !q.solved && q.hintLevel === 2 ? q.target : null,
        interactive: !q.solved,
        feedback,
      };
    }

    case "travel":
    case "results": {
      const attempt = progress.travel;
      if (!attempt) return EMPTY;
      const here = currentCountry(attempt);
      const tones: MapView["tones"] = {};
      for (const id of attempt.path) tones[id] = "visited";
      tones[attempt.to] = "destination";
      if (here !== attempt.to) tones[here] = "current";

      const labels = new Set<CountryId>([...attempt.path, attempt.to]);
      if (progress.stage === "travel" && ui.travelHintVisible) {
        for (const n of neighborsOf(lesson.borders, here)) labels.add(n);
      }
      return {
        ...EMPTY,
        tones,
        labels: [...labels],
        markers: [{ kind: "current", country: here, coordinates: getCountry(here).capital.coordinates }],
        route: attempt.path,
        arrived: attempt.status === "arrived",
      };
    }
  }
}
