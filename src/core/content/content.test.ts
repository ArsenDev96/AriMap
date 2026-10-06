import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/messages.en";
import { hy } from "../i18n/messages.hy";
import { LOCALES } from "../i18n/locales";
import { translate, translatePlural } from "../i18n/translate";
import { LESSON_VERSIONS, LESSONS, LEVELS } from "../lessons";
import { balticJourneyOriginalLesson } from "../lessons/baltic-journey";
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
    // Every version of every level, Level 6's first included.
    for (const lesson of LESSON_VERSIONS) {
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
        // Europe, from Lisbon to Bucharest, Athens, Tallinn and Kyiv (30.5°E, Level 8).
        expect(lon).toBeGreaterThan(-10);
        expect(lon).toBeLessThan(31);
        expect(lat).toBeGreaterThan(35);
        expect(lat).toBeLessThan(60);
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

  it("gives Level 4's new countries their capital and a localized landmark with a map location and its own illustration", () => {
    // Country and capital names as in the English and Armenian Wikipedia article titles (docs/CONTENT.md).
    const expected: Record<string, [string, string, string, string, string, string]> = {
      SVN: ["Slovenia", "Սլովենիա", "Ljubljana", "Լյուբլյանա", "Bled Castle", "Բլեդի ամրոց"],
      HRV: ["Croatia", "Խորվաթիա", "Zagreb", "Զագրեբ", "City Walls of Dubrovnik", "Դուբրովնիկի պարիսպներ"],
      BIH: ["Bosnia and Herzegovina", "Բոսնիա և Հերցեգովինա", "Sarajevo", "Սարաևո", "Stari Most", "Մոստարի կամուրջ"],
      MNE: ["Montenegro", "Չեռնոգորիա", "Podgorica", "Պոդգորիցա", "Ostrog Monastery", "Օստրոգի վանք"],
    };
    for (const [id, [en, hy, capitalEn, capitalHy, landmarkEn, landmarkHy]] of Object.entries(expected)) {
      const c = COUNTRIES[id];
      expect(c.name, id).toEqual({ en, hy });
      // The level card names it the same way as before the level was playable.
      expect(countryName(id), id).toEqual({ en, hy });
      expect(c.capital.name, id).toEqual({ en: capitalEn, hy: capitalHy });
      const landmark = c.landmark!;
      expect(landmark.name, id).toEqual({ en: landmarkEn, hy: landmarkHy });
      // In-sentence forms, with the Armenian definite article (-ը after a consonant, -ն after a vowel).
      expect(landmark.nameInText.hy, id).toBe(`${landmarkHy}ը`);
      expect(c.nameInText.hy, id).toBe(`${hy}${/[աեէըիոօ]$/u.test(hy) ? "ն" : "ը"}`);
      // Each landmark is elsewhere than the capital, with its own map location.
      expect(landmark.coordinates, id).toBeDefined();
      const [dLon, dLat] = [landmark.coordinates![0] - c.capital.coordinates[0], landmark.coordinates![1] - c.capital.coordinates[1]];
      expect(Math.hypot(dLon, dLat), `${id}: landmark at the capital`).toBeGreaterThan(0.3);
      expect(landmark.fact.en.length, id).toBeLessThanOrEqual(110);
      for (const text of [landmark.nameInText, landmark.fact, c.hint]) for (const locale of LOCALES) expect(text[locale].trim().length, id).toBeGreaterThan(0);
    }
    // Each its own artwork (no other country's stands in for it).
    expect(COUNTRIES.SVN.landmark!.illustration).toBe("bled-castle");
    expect(COUNTRIES.HRV.landmark!.illustration).toBe("dubrovnik-city-walls");
    expect(COUNTRIES.BIH.landmark!.illustration).toBe("stari-most");
    expect(COUNTRIES.MNE.landmark!.illustration).toBe("ostrog-monastery");
    // Italy keeps its shared content and artwork; Level 4 describes it within the Adriatic,
    // leaving the shared hint (Level 2's) unchanged.
    const [l2, l4] = [LESSONS["around-the-alps"], LESSONS["along-the-adriatic"]];
    expect(COUNTRIES.ITA.landmark!.illustration).toBe("colosseum");
    expect(countryHint(l2, "ITA").en).toContain("south of the Alps");
    expect(countryHint(l4, "ITA").en).toContain("west side of the Adriatic Sea");
    const hints = l4.countries.map((id) => countryHint(l4, id));
    for (const locale of LOCALES) expect(new Set(hints.map((h) => h[locale])).size).toBe(5);
  });

  it("gives Level 5's countries their capital and a localized landmark away from the capital, with its own illustration", () => {
    // Country, capital and landmark names as in the English and Armenian Wikipedia article titles where
    // one exists (docs/CONTENT.md flags our own renderings).
    const expected: Record<string, [string, string, string, string, string, string, string, string]> = {
      HUN: ["Hungary", "Հունգարիա", "Budapest", "Բուդապեշտ", "Esztergom Basilica", "Էստերգոմի բազիլիկ", "Էստերգոմի բազիլիկը", "esztergom-basilica"],
      ROU: ["Romania", "Ռումինիա", "Bucharest", "Բուխարեստ", "Bran Castle", "Բրանի դղյակ", "Բրանի դղյակը", "bran-castle"],
      SRB: ["Serbia", "Սերբիա", "Belgrade", "Բելգրադ", "Golubac Fortress", "Գոլուբաց ամրոց", "Գոլուբաց ամրոցը", "golubac-fortress"],
      BGR: ["Bulgaria", "Բուլղարիա", "Sofia", "Սոֆիա", "Rila Monastery", "Ռիլայի վանք", "Ռիլայի վանքը", "rila-monastery"],
      GRC: ["Greece", "Հունաստան", "Athens", "Աթենք", "Meteora", "Մետեորա", "Մետեորան", "meteora"],
    };
    const l5 = LESSONS["towards-greece"];
    expect([...l5.countries].sort()).toEqual(Object.keys(expected).sort());
    for (const [id, [en, hy, capitalEn, capitalHy, landmarkEn, landmarkHy, landmarkInText, illustration]] of Object.entries(expected)) {
      const c = COUNTRIES[id];
      expect(c.name, id).toEqual({ en, hy });
      // The level card names it the same way as before the level was playable.
      expect(countryName(id), id).toEqual({ en, hy });
      expect(c.capital.name, id).toEqual({ en: capitalEn, hy: capitalHy });
      expect(c.nameInText.hy, id).toBe(`${hy}${/[աեէըիոօ]$/u.test(hy) ? "ն" : "ը"}`);
      const landmark = c.landmark!;
      expect(landmark.name, id).toEqual({ en: landmarkEn, hy: landmarkHy });
      expect(landmark.nameInText.hy, id).toBe(landmarkInText);
      // Each landmark is elsewhere than the capital, with its own map location.
      expect(landmark.coordinates, id).toBeDefined();
      const [dLon, dLat] = [landmark.coordinates![0] - c.capital.coordinates[0], landmark.coordinates![1] - c.capital.coordinates[1]];
      expect(Math.hypot(dLon, dLat), `${id}: landmark at the capital`).toBeGreaterThan(0.3);
      expect(landmark.fact.en.length, id).toBeLessThanOrEqual(110);
      for (const text of [landmark.nameInText, landmark.fact, c.hint]) for (const locale of LOCALES) expect(text[locale].trim().length, id).toBeGreaterThan(0);
      // Its own artwork (supplied 2026-10-02), with alt text naming the landmark in each language.
      expect(landmark.illustration, id).toBe(illustration);
      expect(translate("en", "discover.landmarkAlt", { landmark: landmark.nameInText.en }), id).toBe(`Illustration of ${landmarkEn}`);
      expect(translate("hy", "discover.landmarkAlt", { landmark: landmark.nameInText.hy }), id).toBe(`Նկարազարդում՝ ${landmarkInText}`);
    }
    // One hint per country, all different, in each language; no player-facing "lesson" wording.
    const hints = l5.countries.map((id) => countryHint(l5, id));
    for (const locale of LOCALES) expect(new Set(hints.map((h) => h[locale])).size).toBe(5);
    for (const id of l5.countries) {
      const c = COUNTRIES[id];
      for (const text of [c.hint, c.landmark!.fact, c.landmark!.name]) expect(`${text.en} ${text.hy}`).not.toMatch(/lesson|դաս/iu);
    }
    expect(l5.regionName).toEqual({ en: "South-eastern Europe", hy: "Հարավարևելյան Եվրոպա" });
  });

  it("gives Level 6's new countries their capital and a localized landmark with its own illustration, and Poland and Belarus their shared content", () => {
    // Country, capital and landmark names as in the English and Armenian Wikipedia article titles where
    // one exists (docs/CONTENT.md flags our own renderings).
    const expected: Record<string, [string, string, string, string, string, string, string, string, string]> = {
      LTU: ["Lithuania", "Լիտվա", "Vilnius", "Վիլնյուս", "Trakai Island Castle", "Տրակայի կղզու դղյակ", "Տրակայի կղզու դղյակը", "trakai-island-castle", "Trakai Island Castle"],
      LVA: ["Latvia", "Լատվիա", "Riga", "Ռիգա", "House of the Black Heads", "Սևագլուխների տուն", "Սևագլուխների տունը", "house-of-the-black-heads", "the House of the Black Heads"],
      EST: ["Estonia", "Էստոնիա", "Tallinn", "Տալլին", "Tallinn Town Hall", "Տալլինի ռատուշա", "Տալլինի ռատուշան", "tallinn-town-hall", "Tallinn Town Hall"],
    };
    const l6 = LESSONS["baltic-journey"];
    expect(l6.countries).toEqual(["POL", "BLR", "LTU", "LVA", "EST"]);
    for (const [id, [en, hy, capitalEn, capitalHy, landmarkEn, landmarkHy, landmarkInText, illustration, landmarkInTextEn]] of Object.entries(expected)) {
      const c = COUNTRIES[id];
      expect(c.name, id).toEqual({ en, hy });
      expect(countryName(id), id).toEqual({ en, hy });
      expect(c.capital.name, id).toEqual({ en: capitalEn, hy: capitalHy });
      expect(c.nameInText.hy, id).toBe(`${hy}${/[աեէըիոօ]$/u.test(hy) ? "ն" : "ը"}`);
      const landmark = c.landmark!;
      expect(landmark.name, id).toEqual({ en: landmarkEn, hy: landmarkHy });
      expect(landmark.nameInText.hy, id).toBe(landmarkInText);
      // Its own map location, stored apart from the capital's (even in the same old town).
      expect(landmark.coordinates, id).toBeDefined();
      expect(landmark.coordinates, id).not.toEqual(c.capital.coordinates);
      expect(landmark.fact.en.length, id).toBeLessThanOrEqual(110);
      for (const text of [landmark.nameInText, landmark.fact, c.hint]) for (const locale of LOCALES) expect(text[locale].trim().length, id).toBeGreaterThan(0);
      // Its own artwork (supplied 2026-10-03), with alt text naming the landmark in each language.
      expect(landmark.illustration, id).toBe(illustration);
      expect(translate("en", "discover.landmarkAlt", { landmark: landmark.nameInText.en }), id).toBe(`Illustration of ${landmarkInTextEn}`);
      expect(translate("hy", "discover.landmarkAlt", { landmark: landmark.nameInText.hy }), id).toBe(`Նկարազարդում՝ ${landmarkInText}`);
    }
    // Trakai is outside the capital; Riga's and Tallinn's landmarks are in their old towns.
    const kmApart = (id: string) => {
      const [[lon1, lat1], [lon2, lat2]] = [COUNTRIES[id].capital.coordinates, COUNTRIES[id].landmark!.coordinates!];
      return Math.hypot((lon2 - lon1) * 111.32 * Math.cos((lat1 * Math.PI) / 180), (lat2 - lat1) * 110.57);
    };
    expect(kmApart("LTU")).toBeGreaterThan(20);
    expect(kmApart("LVA")).toBeLessThan(1);
    expect(kmApart("EST")).toBeLessThan(1);
    // Poland and Belarus keep their content and artwork from earlier levels (Belarus's Mir Castle from Level 8);
    // only their hints are this level's own, and the levels they come from keep theirs.
    expect(COUNTRIES.POL.landmark!.illustration).toBe("wawel-castle");
    expect(COUNTRIES.BLR.landmark!.illustration).toBe("mir-castle");
    expect(countryHint(l6, "POL").en).toBe("The largest country of this region, in its south-west, with a coast on the Baltic Sea.");
    expect(countryHint(l6, "BLR").en).toContain("in the south-east of this region");
    expect(countryHint(LESSONS["central-europe"], "POL")).toEqual(COUNTRIES.POL.hint);
    expect(COUNTRIES.POL.hint.en).toContain("in the north-east of this region");
    expect(countryHint(LESSONS["eastern-europe"], "BLR")).toEqual(COUNTRIES.BLR.hint);
    expect(COUNTRIES.BLR.hint.en).toContain("in the north of this region");
    expect(countryHint(LESSONS["eastern-europe"], "POL").en).toContain("westernmost");
    for (const id of ["LTU", "LVA", "EST"]) expect(countryHint(l6, id), id).toEqual(COUNTRIES[id].hint);
    // One hint per country, all different, in each language; no player-facing "lesson" wording.
    const hints = l6.countries.map((id) => countryHint(l6, id));
    for (const locale of LOCALES) expect(new Set(hints.map((h) => h[locale])).size).toBe(5);
    for (const id of l6.countries) {
      const c = COUNTRIES[id];
      for (const text of [countryHint(l6, id), c.landmark!.fact, c.landmark!.name]) expect(`${text.en} ${text.hy}`).not.toMatch(/lesson|դաս/iu);
    }
    expect(l6.regionName).toEqual({ en: "the Baltic states and their neighbours", hy: "Բալթյան երկրներ և նրանց հարևաններ" });
    expect(LEVELS[5].description.en).toBe("From Warsaw north to Tallinn, by one of two different ways.");
  });

  it("keeps Level 6's first version as it was, for attempts started on it: Germany's and Poland's hints there, its region and its card", () => {
    const first = balticJourneyOriginalLesson;
    expect(first.countries).toEqual(["DEU", "POL", "LTU", "LVA", "EST"]);
    expect(countryHint(first, "DEU").en).toContain("in the south-west of this region");
    expect(countryHint(first, "POL").en).toContain("in the south of this region, east of Germany");
    expect(first.regionName).toEqual({ en: "the Baltic Sea countries", hy: "Բալթիկ ծովի երկրներ" });
    expect(LEVELS[5].earlier![0].description.en).toBe("From Berlin along the Baltic Sea to Tallinn, through Poland, Lithuania and Latvia.");
    const hints = first.countries.map((id) => countryHint(first, id));
    for (const locale of LOCALES) expect(new Set(hints.map((h) => h[locale])).size).toBe(5);
  });

  it("gives Level 7's new countries their capital and a localized landmark with its own illustration, and France and Italy their shared content", () => {
    // Country, capital and landmark names as in the English and Armenian Wikipedia article titles where
    // one exists (docs/CONTENT.md flags our own renderings).
    const expected: Record<string, [string, string, string, string, string, string, string, string, string]> = {
      PRT: ["Portugal", "Պորտուգալիա", "Lisbon", "Լիսաբոն", "Belém Tower", "Բելեմի աշտարակ", "Բելեմի աշտարակը", "Belém Tower", "belem-tower"],
      ESP: ["Spain", "Իսպանիա", "Madrid", "Մադրիդ", "Sagrada Família", "Սագրադա Ֆամիլիա", "Սագրադա Ֆամիլիան", "the Sagrada Família", "sagrada-familia"],
      AND: ["Andorra", "Անդորրա", "Andorra la Vella", "Անդորրա լա Վելյա", "Casa de la Vall", "Կասա դե լա Վալ", "Կասա դե լա Վալը", "Casa de la Vall", "casa-de-la-vall"],
    };
    const l7 = LESSONS["iberian-journey"];
    expect(l7.countries).toEqual(["PRT", "ESP", "AND", "FRA", "ITA"]);
    for (const [id, [en, hy, capitalEn, capitalHy, landmarkEn, landmarkHy, landmarkInText, landmarkInTextEn, illustration]] of Object.entries(expected)) {
      const c = COUNTRIES[id];
      expect(c.name, id).toEqual({ en, hy });
      expect(countryName(id), id).toEqual({ en, hy });
      expect(c.capital.name, id).toEqual({ en: capitalEn, hy: capitalHy });
      expect(c.nameInText.hy, id).toBe(`${hy}${/[աեէըիոօ]$/u.test(hy) ? "ն" : "ը"}`);
      const landmark = c.landmark!;
      expect(landmark.name, id).toEqual({ en: landmarkEn, hy: landmarkHy });
      expect(landmark.nameInText, id).toEqual({ en: landmarkInTextEn, hy: landmarkInText });
      expect(landmark.coordinates, id).toBeDefined();
      expect(landmark.coordinates, id).not.toEqual(c.capital.coordinates);
      expect(landmark.fact.en.length, id).toBeLessThanOrEqual(110);
      for (const text of [landmark.nameInText, landmark.fact, c.hint]) for (const locale of LOCALES) expect(text[locale].trim().length, id).toBeGreaterThan(0);
      // Its own artwork (supplied 2026-10-04), with alt text naming the landmark in each language.
      expect(landmark.illustration, id).toBe(illustration);
      expect(translate("en", "discover.landmarkAlt", { landmark: landmark.nameInText.en }), id).toBe(`Illustration of ${landmarkInTextEn}`);
      expect(translate("hy", "discover.landmarkAlt", { landmark: landmark.nameInText.hy }), id).toBe(`Նկարազարդում՝ ${landmarkInText}`);
    }
    // Belém Tower is in Lisbon's west, the Sagrada Família in Barcelona, Casa de la Vall in Andorra la Vella's old quarter.
    const kmApart = (id: string) => {
      const [[lon1, lat1], [lon2, lat2]] = [COUNTRIES[id].capital.coordinates, COUNTRIES[id].landmark!.coordinates!];
      return Math.hypot((lon2 - lon1) * 111.32 * Math.cos((lat1 * Math.PI) / 180), (lat2 - lat1) * 110.57);
    };
    expect(kmApart("PRT")).toBeGreaterThan(5);
    expect(kmApart("ESP")).toBeGreaterThan(450);
    expect(kmApart("AND")).toBeLessThan(0.5);
    // France and Italy keep their content and artwork from earlier levels; only France's hint is this level's own.
    expect(COUNTRIES.FRA.landmark!.illustration).toBe("eiffel-tower");
    expect(COUNTRIES.ITA.landmark!.illustration).toBe("colosseum");
    expect(countryHint(l7, "FRA").en).toContain("north of the Pyrenees");
    expect(countryHint(l7, "ITA")).toEqual(COUNTRIES.ITA.hint);
    for (const id of ["western-europe-1", "around-the-alps"]) expect(countryHint(LESSONS[id], "FRA")).toEqual(COUNTRIES.FRA.hint);
    // One hint per country, all different, in each language; no player-facing "lesson" wording.
    const hints = l7.countries.map((id) => countryHint(l7, id));
    for (const locale of LOCALES) expect(new Set(hints.map((h) => h[locale])).size).toBe(5);
    for (const id of l7.countries) {
      const c = COUNTRIES[id];
      for (const text of [countryHint(l7, id), c.landmark!.fact, c.landmark!.name]) expect(`${text.en} ${text.hy}`).not.toMatch(/lesson|դաս/iu);
    }
    expect(l7.regionName).toEqual({ en: "South-western Europe", hy: "Հարավարևմտյան Եվրոպա" });
  });

  it("gives Level 8's new countries their capital and a localized landmark with its own illustration, and Poland and Romania their shared content", () => {
    // Country and capital names as in the English and Armenian Wikipedia article titles; Chisinau without
    // diacritics (the CIA World Factbook's and the UN's spelling). Landmark names in Armenian are our own
    // renderings where no article exists (docs/CONTENT.md flags them).
    const expected: Record<string, [string, string, string, string, string, string, string, string, string]> = {
      BLR: ["Belarus", "Բելառուս", "Minsk", "Մինսկ", "Mir Castle", "Միրի ամրոց", "Միրի ամրոցը", "Mir Castle", "mir-castle"],
      UKR: ["Ukraine", "Ուկրաինա", "Kyiv", "Կիև", "Saint Sophia Cathedral", "Սուրբ Սոֆիայի տաճար", "Սուրբ Սոֆիայի տաճարը", "Saint Sophia Cathedral", "saint-sophia-cathedral"],
      MDA: ["Moldova", "Մոլդովա", "Chisinau", "Քիշնև", "Soroca Fortress", "Սորոկիի ամրոց", "Սորոկիի ամրոցը", "Soroca Fortress", "soroca-fortress"],
    };
    const l8 = LESSONS["eastern-europe"];
    expect(l8.countries).toEqual(["POL", "BLR", "UKR", "MDA", "ROU"]);
    for (const [id, [en, hy, capitalEn, capitalHy, landmarkEn, landmarkHy, landmarkInText, landmarkInTextEn, illustration]] of Object.entries(expected)) {
      const c = COUNTRIES[id];
      expect(c.name, id).toEqual({ en, hy });
      expect(countryName(id), id).toEqual({ en, hy });
      expect(c.capital.name, id).toEqual({ en: capitalEn, hy: capitalHy });
      expect(c.nameInText.hy, id).toBe(`${hy}${/[աեէըիոօ]$/u.test(hy) ? "ն" : "ը"}`);
      const landmark = c.landmark!;
      expect(landmark.name, id).toEqual({ en: landmarkEn, hy: landmarkHy });
      expect(landmark.nameInText, id).toEqual({ en: landmarkInTextEn, hy: landmarkInText });
      expect(landmark.coordinates, id).toBeDefined();
      expect(landmark.coordinates, id).not.toEqual(c.capital.coordinates);
      expect(landmark.fact.en.length, id).toBeLessThanOrEqual(110);
      for (const text of [landmark.nameInText, landmark.fact, c.hint]) for (const locale of LOCALES) expect(text[locale].trim().length, id).toBeGreaterThan(0);
      // Its own artwork (supplied 2026-10-05), with alt text naming the landmark in each language.
      expect(landmark.illustration, id).toBe(illustration);
      expect(translate("en", "discover.landmarkAlt", { landmark: landmark.nameInText.en }), id).toBe(`Illustration of ${landmarkInTextEn}`);
      expect(translate("hy", "discover.landmarkAlt", { landmark: landmark.nameInText.hy }), id).toBe(`Նկարազարդում՝ ${landmarkInText}`);
      // Names drawn in the app's fonts: no Latin letters beyond the "latin" subset it loads.
      for (const text of [c.name.en, c.capital.name.en, landmark.name.en, landmark.fact.en]) expect(text, id).toMatch(/^[\u0000-\u00ff\u2013\u2060]*$/u);
    }
    // Mir is south-west of Minsk, Soroca on the Dniester; Saint Sophia is in Kyiv's historic centre.
    const kmApart = (id: string) => {
      const [[lon1, lat1], [lon2, lat2]] = [COUNTRIES[id].capital.coordinates, COUNTRIES[id].landmark!.coordinates!];
      return Math.hypot((lon2 - lon1) * 111.32 * Math.cos((lat1 * Math.PI) / 180), (lat2 - lat1) * 110.57);
    };
    expect(kmApart("BLR")).toBeGreaterThan(50);
    expect(kmApart("MDA")).toBeGreaterThan(100);
    expect(kmApart("UKR")).toBeLessThan(1);
    // Poland and Romania keep their content and artwork from earlier levels; only their hints are this level's own.
    expect(COUNTRIES.POL.landmark!.illustration).toBe("wawel-castle");
    expect(COUNTRIES.ROU.landmark!.illustration).toBe("bran-castle");
    expect(countryHint(l8, "POL").en).toContain("westernmost country of this region");
    expect(countryHint(l8, "ROU").en).toContain("southernmost country of this region");
    expect(countryHint(LESSONS["central-europe"], "POL")).toEqual(COUNTRIES.POL.hint);
    expect(countryHint(LESSONS["towards-greece"], "ROU")).toEqual(COUNTRIES.ROU.hint);
    // Ukraine's own hint fits here: the largest of the five.
    expect(countryHint(l8, "UKR")).toEqual(COUNTRIES.UKR.hint);
    // One hint per country, all different, in each language; no player-facing "lesson" wording.
    const hints = l8.countries.map((id) => countryHint(l8, id));
    for (const locale of LOCALES) expect(new Set(hints.map((h) => h[locale])).size).toBe(5);
    for (const id of l8.countries) {
      const c = COUNTRIES[id];
      for (const text of [countryHint(l8, id), c.landmark!.fact, c.landmark!.name]) expect(`${text.en} ${text.hy}`).not.toMatch(/lesson|դաս/iu);
    }
    expect(l8.regionName).toEqual({ en: "Eastern Europe", hy: "Արևելյան Եվրոպա" });
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
    // No player-facing "lesson" wording, earlier versions' descriptions included.
    for (const level of LEVELS) for (const text of [level.title, level.description, ...(level.earlier ?? []).map((v) => v.description)]) expect(`${text.en} ${text.hy}`).not.toMatch(/lesson|դաս/iu);
    for (const value of [...Object.values(en), ...Object.values(hy)]) expect(value).not.toMatch(/lesson|դաս/iu);
  });
});
