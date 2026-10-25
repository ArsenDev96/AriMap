import { useRef } from "react";
import type { GestureResponderEvent } from "react-native";
import type { Point, Transform } from "@/geo/regionMap";
import type { CameraLimits } from "./camera";
import { beginGesture, endGesture, moveGesture, type Finger, type MapGesture } from "./gesture";

/**
 * A map's touches (the lesson map's and the Quick Challenge's): drag and pinch move the view within `limits`
 * (gesture.ts, camera.ts), and a press that stays a tap calls `onTap` with where it began and where it ended, on the
 * map, for the caller to resolve (the website's rule: the same country at both). The map takes every touch that
 * starts on it and keeps it: while a finger is on the map, nothing else (a parent, the screen) takes the gesture over.
 * Spread the returned handlers on the view the map is drawn in.
 */
export function useMapGesture({
  camera,
  size,
  limits,
  onCamera,
  onTap,
}: {
  camera: Transform | null;
  size: { width: number; height: number } | null;
  limits: CameraLimits | null;
  onCamera: (t: Transform) => void;
  onTap: (start: Point, end: Point) => void;
}) {
  // The fingers on the map: the gesture so far (gesture.ts), and the map's position on the page.
  const gesture = useRef<{ g: MapGesture; offset: [number, number] } | null>(null);
  const fingersOf = (e: GestureResponderEvent, offset: [number, number]): Finger[] =>
    e.nativeEvent.touches.map((touch) => ({ id: String(touch.identifier), at: [touch.pageX - offset[0], touch.pageY - offset[1]] as const }));

  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      if (!camera) return;
      // The map's own coordinates: the page position of this first touch less its position on the map.
      const offset: [number, number] = [e.nativeEvent.pageX - e.nativeEvent.locationX, e.nativeEvent.pageY - e.nativeEvent.locationY];
      gesture.current = { g: beginGesture(camera, fingersOf(e, offset), e.nativeEvent.timestamp), offset };
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const current = gesture.current;
      if (!current || !camera || !size || !limits) return;
      const { gesture: g, view: next } = moveGesture(current.g, camera, fingersOf(e, current.offset), { width: size.width, height: size.height, limits });
      gesture.current = { g, offset: current.offset };
      if (next !== camera) onCamera(next);
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const current = gesture.current;
      gesture.current = null;
      if (!current) return;
      const at: [number, number] = [e.nativeEvent.pageX - current.offset[0], e.nativeEvent.pageY - current.offset[1]];
      const point = endGesture(current.g, at, e.nativeEvent.timestamp);
      if (point && current.g.tap) onTap(current.g.tap.at, point);
    },
    onResponderTerminate: () => {
      gesture.current = null;
    },
  };
}
