import { Circle, G, Line } from "react-native-svg";
import { RING_RADIUS, ringLeader, type Ring } from "@/core/challenge/smallCountries";
import { colors, mapColors } from "../theme/tokens";

/** A ring's dashes and gaps, evenly round it (the website's twelve). */
const RING_DASH = (2 * Math.PI * RING_RADIUS) / 24;

/**
 * A small country's ring (smallCountries.ts), as the website draws it: dashed, on a white halo, filled with its
 * country's colour once it has one (`fill`, else the plain ring's); a ring drawn beside its country (RING_OFFSETS) has
 * a leader to it. The lesson map and the Quick Challenge's both draw theirs so.
 */
export function RingMark({ ring, fill, strong = false }: { ring: Ring; fill?: string; strong?: boolean }) {
  const leader = ringLeader(ring);
  return (
    <G>
      {leader && (
        <>
          <Line {...leader} stroke={mapColors.ringHalo} strokeWidth={3.5} strokeLinecap="round" />
          <Line {...leader} stroke={colors.ink} strokeWidth={1.25} strokeLinecap="round" />
        </>
      )}
      <Circle cx={ring.x} cy={ring.y} r={RING_RADIUS} fill="none" stroke={mapColors.ringHalo} strokeWidth={3.5} />
      <Circle
        cx={ring.x}
        cy={ring.y}
        r={RING_RADIUS}
        fill={fill ?? mapColors.ringFill}
        fillOpacity={fill ? 0.6 : 1}
        stroke={colors.ink}
        strokeWidth={strong ? 2.5 : 1.25}
        strokeDasharray={`${RING_DASH} ${RING_DASH}`}
      />
    </G>
  );
}
