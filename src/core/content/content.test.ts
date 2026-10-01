import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/messages.en";
import { hy } from "../i18n/messages.hy";
import { LOCALES } from "../i18n/locales";
import { translate, translatePlural } from "../i18n/translate";
import { LESSONS, LEVELS } from "../lessons";
import { COUNTRIES, countryHint } from "./countries";
import { countryName } from "./names";

describe("translations", () => {
  it("Armenian has exactly the English keys, all non-empty", () => {
    expect(Object.keys(hy).sort()).toEqual(Object.keys(en).sort());
    for (const value of Object.values(hy)) expect(value.trim()).not.toBe("");
  });

  it("uses the same placeholders in both languages", () => {
    // Callers pass both {country} (in-sentence form) and {name} (base form);
    // a language may pick whichever its grammar needs.
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).map((p) => (p === "{name}" ? "{country}" : p)).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(hy[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it("uses the app name and tagline", () => {
    expect(translate("en", "app.name")).toBe("AriMap");
    expect(translate("hy", "app.name")).toBe("ԱրիՄապ");
    expect(translate("en", "app.tagline")).toBe("Discover the world.");
    expect(translate("hy", "app.tagline")).toBe("Բացահայտիր աշխարհը");
  });

  it("selects plural forms", () => {
    expect(translatePlural("en", "travel.crossingsLeft", 1)).toBe("1 crossing left");
    expect(translatePlural("en", "travel.crossingsLeft", 2)).toBe("2 crossings left");
    expect(translatePlural("hy", "travel.crossingsLeft", 2)).toBe("Մնաց 2 սահմանահատում");
  });
});

describe("country content", () => {
  it("covers every lesson country with localized text and plausible coordinates", () => {
    for (const lesson of Object.values(LESSONS)) {
      for (const id of lesson.countries) {
        const c = COUNTRIES[id];
        expect(c, id).toBeDefined();
        for (const locale of LOCALES) {
          expect(c.name[locale]).toBeTruthy();
          expect(c.nameInText[locale]).toBeTruthy();
          expect(c.capital.name[locale]).toBeTruthy();
          expect(c.hint[locale]).toBeTruthy();
        }
        const [lon, lat] = c.capital.coordinates;
        expect(lon).toBeGreaterThan(-10);
        expect(lon).toBeLessThan(25);
        expect(lat).toBeGreaterThan(40);
        expect(lat).toBeLessThan(58);
      }
    }
  });

  it("keeps France's landmark separate from its capital", () => {
    const france = COUNTRIES.FRA;
    expect(france.capital.name.en).toBe("Paris");
    expect(france.landmark?.name.en).toBe("Eiffel Tower");
    expect(france.landmark?.coordinates).not.toEqual(france.capital.coordinates);
  });

  it("gives every lesson country a localized, illustrated landmark", () => {
    const expected: Record<string, [string, string, string]> = {
      FRA: ["Eiffel Tower", "Էյֆելյան աշտարակ", "eiffel-tower"],
      BEL: ["Atomium", "Ատոմիում", "atomium"],
      NLD: ["Amsterdam canal houses", "Ամստերդամի ջրանցքների տները", "amsterdam-canal-houses"],
      LUX: ["Adolphe Bridge", "Ադոլֆի կամուրջ", "adolphe-bridge"],
      DEU: ["Brandenburg Gate", "Բրանդենբուրգյան դարպասներ", "brandenburg-gate"],
    };
    for (const [id, [en, hy, illustration]] of Object.entries(expected)) {
      const landmark = COUNTRIES[id].landmark!;
      expect(landmark.name).toEqual({ en, hy });
      expect(landmark.illustration).toBe(illustration);
      for (const text of [landmark.nameInText, landmark.fact]) {
        expect(text.en.trim().length, id).toBeGreaterThan(0);
        expect(text.hy.trim().length, id).toBeGreaterThan(0);
      }
      // One short fact, not a paragraph.
      expect(landmark.fact.en.length, id).toBeLessThanOrEqual(110);
      if (landmark.coordinates) expect(landmark.coordinates, id).not.toEqual(COUNTRIES[id].capital.coordinates);
    }
    // The canal houses are a group of buildings: no invented single location.
    expect(COUNTRIES.NLD.landmark!.coordinates).toBeUndefined();
  });

  it("gives Level 2's new countries a localized, illustrated landmark with a map location", () => {
    const expected: Record<string, [string, string, string, string]> = {
      CHE: ["Chapel Bridge", "Մատուռի կամուրջ", "Bern", "chapel-bridge"],
      AUT: ["Schönbrunn Palace", "Շյոնբրունի պալատ", "Vienna", "schonbrunn-palace"],
      ITA: ["Colosseum", "Կոլիզեում", "Rome", "colosseum"],
    };
    for (const [id, [en, hy, capital, illustration]] of Object.entries(expected)) {
      const c = COUNTRIES[id];
      expect(c.capital.name.en).toBe(capital);
      const landmark = c.landmark!;
      expect(landmark.name).toEqual({ en, hy });
      // Its own artwork (no other country's stands in for it).
      expect(landmark.illustration, id).toBe(illustration);
      expect(landmark.coordinates, id).toBeDefined();
      expect(landmark.coordinates, id).not.toEqual(c.capital.coordinates);
      expect(landmark.fact.en.length, id).toBeLessThanOrEqual(110);
      for (const text of [landmark.nameInText, landmark.fact]) for (const locale of LOCALES) expect(text[locale].trim().length, id).toBeGreaterThan(0);
    }
  });

  it("gives Level 3's new countries their capital and a localized, illustrated landmark with a map location", () => {
    // Names as in the English and Armenian Wikipedia article titles (docs/CONTENT.md).
    const expected: Record<string, [string, string, string, string, string, string]> = {
      POL: ["Poland", "Լեհաստան", "Warsaw", "Վարշավա", "Wawel Castle", "Վավելի ամրոց"],
      CZE: ["Czechia", "Չեխիա", "Prague", "Պրահա", "Charles Bridge", "Կառլի կամուրջ"],
      SVK: ["Slovakia", "Սլովակիա", "Bratislava", "Բրատիսլավա", "Bratislava Castle", "Բրատիսլավայի ամրոց"],
    };
    for (const [id, [en, hy, capitalEn, capitalHy, landmarkEn, landmarkHy]] of Object.entries(expected)) {
      const c = COUNTRIES[id];
      expect(c.name, id).toEqual({ en, hy });
      expect(c.capital.name, id).toEqual({ en: capitalEn, hy: capitalHy });
      const landmark = c.landmark!;
      expect(landmark.name, id).toEqual({ en: landmarkEn, hy: landmarkHy });
      // In-sentence forms, with the Armenian definite article (-ը after a consonant, -ն after a vowel).
      expect(landmark.nameInText.hy, id).toBe(`${landmarkHy}ը`);
      expect(c.nameInText.hy, id).toBe(`${hy}${/[աեէըիոօ]$/u.test(hy) ? "ն" : "ը"}`);
      expect(landmark.coordinates, id).toBeDefined();
      expect(landmark.coordinates, id).not.toEqual(c.capital.coordinates);
      expect(landmark.fact.en.length, id).toBeLessThanOrEqual(110);
      for (const text of [landmark.nameInText, landmark.fact, c.hint]) for (const locale of LOCALES) expect(text[locale].trim().length, id).toBeGreaterThan(0);
    }
    // Each its own artwork (no other country's stands in for it).
    expect(COUNTRIES.POL.landmark!.illustration).toBe("wawel-castle");
    expect(COUNTRIES.CZE.landmark!.illustration).toBe("charles-bridge");
    expect(COUNTRIES.SVK.landmark!.illustration).toBe("bratislava-castle");
    // Wawel Castle is in Kraków, not the capital.
    expect(COUNTRIES.POL.landmark!.fact.en).toContain("Kraków");
    // Germany and Austria are shared with earlier levels: same content and artwork.
    expect(COUNTRIES.DEU.landmark!.illustration).toBe("brandenburg-gate");
    expect(COUNTRIES.AUT.landmark!.illustration).toBe("schonbrunn-palace");
  });

  it("describes Germany and Austria within each level's own region, leaving earlier levels' hints unchanged", () => {
    const [l1, l2, l3] = [LESSONS["western-europe-1"], LESSONS["around-the-alps"], LESSONS["central-europe"]];
    expect(countryHint(l1, "DEU").en).toContain("in the east of this region");
    expect(countryHint(l2, "DEU").en).toContain("in the north of this region");
    expect(countryHint(l3, "DEU").en).toContain("in the west of this region");
    expect(countryHint(l2, "AUT").en).toContain("in the east of this region");
    expect(countryHint(l3, "AUT").en).toContain("in the south of this region");
    // Every Level 3 country has one hint per language, and no two are the same.
    const hints = l3.countries.map((id) => countryHint(l3, id));
    for (const locale of LOCALES) expect(new Set(hints.map((h) => h[locale])).size).toBe(5);
  });

  it("has the supplied original and its prepared display copy for every illustration", () => {
    const keys = Object.values(COUNTRIES).flatMap((c) => (c.landmark?.illustration ? [c.landmark.illustration] : []));
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(existsSync(`public/images/landmarks/${key}.png`), key).toBe(true);
      expect(existsSync(`src/assets/landmarks/${key}.webp`), key).toBe(true);
    }
  });

  it("names every country of every level, playable or not, in both languages", () => {
    for (const level of LEVELS) {
      expect(level.title.en && level.title.hy && level.description.en && level.description.hy, level.id).toBeTruthy();
      for (const id of level.countries) for (const locale of LOCALES) expect(countryName(id)[locale], `${level.id} ${id}`).toBeTruthy();
    }
    // No player-facing "lesson" wording.
    for (const level of LEVELS) for (const text of [level.title, level.description]) expect(`${text.en} ${text.hy}`).not.toMatch(/lesson|դաս/iu);
    for (const value of [...Object.values(en), ...Object.values(hy)]) expect(value).not.toMatch(/lesson|դաս/iu);
  });
});
