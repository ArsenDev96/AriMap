import type { LocalizedText } from "../i18n/locales";

/**
 * Stable country identifier used throughout game logic and saved progress.
 * Matches the Natural Earth ADM0_A3 code stored as the TopoJSON feature id.
 */
export type CountryId = string;

/** Geographic coordinates as [longitude, latitude] in degrees (WGS84). */
export type LonLat = readonly [number, number];

export interface Place {
  name: LocalizedText;
  coordinates: LonLat;
}

export interface Landmark {
  id: string;
  name: LocalizedText;
  /** Name as used inside a sentence, e.g. "the Eiffel Tower" / "Էյֆելյան աշտարակը". */
  nameInText: LocalizedText;
  /** One short, verified fact (sources in docs/CONTENT.md). */
  fact: LocalizedText;
  /**
   * Monument position, shown as a map pin. Omitted for landmarks that are a group
   * of buildings rather than one place (e.g. Amsterdam's canal houses).
   */
  coordinates?: LonLat;
  /** Key of an illustration provided by the UI layer, if any. */
  illustration?: string;
}

export interface CountryContent {
  id: CountryId;
  name: LocalizedText;
  /** Name as used inside a sentence, e.g. "the Netherlands" / "Նիդեռլանդները". */
  nameInText: LocalizedText;
  capital: Place;
  /** Short localized geographic hint (a level may replace it to fit its region: `LessonDefinition.hints`). */
  hint: LocalizedText;
  /**
   * Where the map label is anchored (must lie inside the country). A level can
   * name a country too small for an in-place label (`map.smallCountries`): it is
   * labelled beside the country with a leader line to this point until zooming
   * makes it large enough.
   */
  label: { coordinates: LonLat };
  /** Landmarks are separate from the capital: they are not always in the capital city. */
  landmark?: Landmark;
}
