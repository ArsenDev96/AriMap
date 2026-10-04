import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import relief from "@/assets/map/relief.json";
import type { LonLat } from "@/core/content/types";
import { LESSONS } from "@/core/lessons";
import { regionMapFor, viewLimits, type RegionMap } from "./regionMap";
import { FORESTS, MOUNTAIN_RANGES } from "./terrain";

type Overview = (typeof relief.overviews)["western-europe-1"];
const overviews = relief.overviews as Record<string, Overview | undefined>;
const lessons = Object.values(LESSONS);

/** Strongest relief opacity (0–255) within `r` pixels of a point, in a level's land overview. */
async function alphaSampler(levelId: string, map: RegionMap) {
  const { data, info } = await sharp(`src/assets/map/relief/${levelId}-land.webp`).raw().toBuffer({ resolveWithObject: true });
  const o = overviews[levelId]!.land;
  return (p: LonLat, r = 2) => {
    const [x, y] = map.project(p);
    const [i, j] = [Math.floor(x - o.x), Math.floor(y - o.y)];
    let m = 0;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) m = Math.max(m, data[((j + dj) * info.width + i + di) * info.channels + 3]);
    return m;
  };
}

describe("painted relief", () => {
  it("was generated with the map's own projection (shared by every level)", () => {
    for (const lesson of lessons) {
      const map = regionMapFor(lesson);
      for (const { lonLat, world } of relief.check) {
        const [x, y] = map.project(lonLat as unknown as LonLat);
        expect(Math.abs(x - world[0]), `${lesson.id} ${lonLat}`).toBeLessThan(0.01);
        expect(Math.abs(y - world[1]), `${lesson.id} ${lonLat}`).toBeLessThan(0.01);
      }
    }
  });

  for (const lesson of lessons) {
    it(`${lesson.id}: its overview covers everything its map can show, and every country that can take a state colour`, () => {
      const map = regionMapFor(lesson);
      const o = overviews[lesson.id];
      expect(o, "overview in relief.json").toBeDefined();
      expect(existsSync(`src/assets/map/relief/${lesson.id}-land.webp`)).toBe(true);
      expect(existsSync(`src/assets/map/relief/${lesson.id}-tone.webp`)).toBe(true);
      const { land, tone } = o!;
      const [[c0x, c0y], [c1x, c1y]] = map.coverage;
      expect(land.x).toBeLessThanOrEqual(c0x);
      expect(land.y).toBeLessThanOrEqual(c0y);
      expect(land.x + land.width).toBeGreaterThanOrEqual(c1x - 1);
      expect(land.y + land.height).toBeGreaterThanOrEqual(c1y - 1);
      for (const id of lesson.countries) {
        const [[x0, y0], [x1, y1]] = map.shapes.find((s) => s.id === id)!.bounds;
        expect(x0, id).toBeGreaterThanOrEqual(tone.x);
        expect(y0, id).toBeGreaterThanOrEqual(tone.y);
        expect(x1, id).toBeLessThanOrEqual(tone.x + tone.width);
        expect(y1, id).toBeLessThanOrEqual(tone.y + tone.height);
      }
    });

    it(`${lesson.id}: its overview images are registered for the map to draw`, () => {
      // src/components/map/Relief.tsx imports each level's overview by name (an import only gives a URL,
      // so no level fetches another's); a level missing there would show no landscape at all.
      const source = readFileSync("src/components/map/Relief.tsx", "utf8");
      const entry = new RegExp(`"${lesson.id}": \\{ land: (\\w+), tone: (\\w+) \\}`).exec(source);
      expect(entry, `${lesson.id} in OVERVIEW_IMAGES`).not.toBeNull();
      for (const [name, family] of [[entry![1], "land"], [entry![2], "tone"]]) {
        expect(source, `${name} imported`).toContain(`import ${name} from "@/assets/map/relief/${lesson.id}-${family}.webp";`);
      }
    });

    it(`${lesson.id}: zoomed tiles cover everywhere its map can be zoomed and panned to`, () => {
      const [[e0x, e0y], [e1x, e1y]] = viewLimits(regionMapFor(lesson), 390, 400, 16).translateExtent;
      for (const level of relief.levels) {
        expect(level.origin[0]).toBeLessThanOrEqual(e0x);
        expect(level.origin[1]).toBeLessThanOrEqual(e0y);
        expect(level.origin[0] + level.cols * level.tileWorld).toBeGreaterThanOrEqual(e1x);
        expect(level.origin[1] + level.rows * level.tileWorld).toBeGreaterThanOrEqual(e1y);
      }
    });
  }

  it("has one tile grid for all levels, no larger than their pan areas need, and every listed tile exists", () => {
    const extents = lessons.map((lesson) => viewLimits(regionMapFor(lesson), 390, 400, 16).translateExtent);
    const x1 = Math.max(...extents.map((e) => e[1][0]));
    const y1 = Math.max(...extents.map((e) => e[1][1]));
    let previous = 0;
    for (const level of relief.levels) {
      expect(level.minDensity).toBeGreaterThan(previous);
      previous = level.minDensity;
      // Anchored where Level 1's grid began, so its tiles keep their pixels as levels are added.
      expect(Math.abs((level.origin[0] + 216) % level.tileWorld)).toBe(0);
      expect(Math.abs((level.origin[1] + 250) % level.tileWorld)).toBe(0);
      expect(level.origin[0] + (level.cols - 1) * level.tileWorld).toBeLessThan(x1);
      expect(level.origin[1] + (level.rows - 1) * level.tileWorld).toBeLessThan(y1);
      for (const family of ["land", "tone"] as const)
        for (const tile of level[family]) expect(existsSync(`public/relief/${relief.version}/${level.name}/${family}/${tile}.webp`), `${level.name} ${family} ${tile}`).toBe(true);
    }
  });

  it("uses only elevation sources the credits name (SRTM, GMTED2010, ETOPO1)", () => {
    const sources = Object.keys(relief.elevationSources);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) expect(["srtm", "gmted", "etopo1"], source).toContain(source);
  });

  it("Level 1: shows mountains and upland ranges where they are, and leaves open lowlands flat", async () => {
    const alphaNear = await alphaSampler("western-europe-1", regionMapFor(LESSONS["western-europe-1"]));
    // Every named range (independent crest data through real summits, see terrain.ts) is visible along its crest.
    for (const range of MOUNTAIN_RANGES) {
      const strongest = Math.max(...range.crests.flat().map((p) => alphaNear(p)));
      expect(strongest, range.id).toBeGreaterThanOrEqual(range.id === "alps" || range.id === "pyrenees" ? 200 : 45);
    }
    // Open farmland and city centres on low ground: no relief and no forest.
    // (Madrid is on the Meseta, a high plateau with scattered woods: still subtle.)
    const open: Record<string, LonLat> = {
      "Beauce (farmland)": [1.6, 48.3],
      "Champagne (farmland)": [4.2, 48.9],
      "Flevoland (polder)": [5.6, 52.5],
      "Magdeburger Börde (farmland)": [11.6, 52.0],
      "Paris centre": [2.35, 48.86],
      "Amsterdam centre": [4.9, 52.37],
      "London centre": [-0.13, 51.5],
    };
    for (const [place, p] of Object.entries(open)) expect(alphaNear(p, 1), place).toBeLessThanOrEqual(25);
    expect(alphaNear([-3.7, 40.42], 3), "Madrid").toBeLessThanOrEqual(40);
  });

  it("Level 1: paints forests where WorldCover has tree cover, not on open farmland", async () => {
    const alphaNear = await alphaSampler("western-europe-1", regionMapFor(LESSONS["western-europe-1"]));
    // Named forests (independent reference points: the Wikipedia articles'
    // coordinates), including lowland ones where only forest can paint the land.
    for (const f of FORESTS) expect(alphaNear(f.center, 2), f.id).toBeGreaterThanOrEqual(40);
    // Large open farmland with no woods: nothing painted.
    for (const p of [[1.6, 48.3], [4.2, 48.9], [5.6, 52.5], [11.6, 52.0]] as LonLat[]) expect(alphaNear(p, 0), String(p)).toBeLessThanOrEqual(10);
  });

  // Level 2 reaches south to Sicily and east to Vienna. Reference points: the
  // Wikipedia articles' coordinates (checked 2026-09-30; see docs/TERRAIN.md).
  it("Level 2: shows the Alps, the Apennines and Etna, and forests from Vienna to Calabria; open farmland stays bare", async () => {
    const alphaNear = await alphaSampler("around-the-alps", regionMapFor(LESSONS["around-the-alps"]));
    const summits: Record<string, [LonLat, number]> = {
      "Gran Paradiso": [[7.27, 45.514], 200],
      Finsteraarhorn: [[8.126, 46.537], 200],
      Grossglockner: [[12.695, 47.075], 200],
      Dachstein: [[13.606, 47.475], 150],
      Säntis: [[9.343, 47.249], 150],
      "Monte Cimone": [[10.701, 44.194], 45],
      "Corno Grande": [[13.566, 42.469], 45],
      "Mount Etna": [[14.995, 37.755], 45],
    };
    for (const [name, [p, min]] of Object.entries(summits)) expect(alphaNear(p), name).toBeGreaterThanOrEqual(min);
    for (const range of MOUNTAIN_RANGES.filter((r) => ["alps", "apennines", "jura", "black-forest"].includes(r.id))) {
      expect(Math.max(...range.crests.flat().map((p) => alphaNear(p))), range.id).toBeGreaterThanOrEqual(range.id === "alps" ? 200 : 45);
    }
    const forests: Record<string, LonLat> = {
      "Vienna Woods": [16.0, 48.167],
      Sila: [16.5, 39.367],
      "Foresta Umbra": [16.012, 41.821],
      "Casentino Forests": [11.779, 43.868],
      "Black Forest": [8.05, 48.25],
    };
    for (const [name, p] of Object.entries(forests)) expect(alphaNear(p, 2), name).toBeGreaterThanOrEqual(40);
    // Rice fields of the Lomellina (Po valley) and the Marchfeld east of Vienna: open, flat farmland.
    for (const [name, p] of Object.entries({ Lomellina: [8.66, 45.28], Marchfeld: [16.64, 48.23] } as Record<string, LonLat>)) {
      expect(alphaNear(p, 0), name).toBeLessThanOrEqual(10);
    }
  });

  // Level 3 reaches east to Poland's border with Belarus and Ukraine. Reference points: the
  // Wikipedia articles' coordinates (checked 2026-09-30; see docs/TERRAIN.md).
  it("Level 3: shows the Tatras, the Sudetes and the Carpathians, forests from Lusatia to Białowieża; the plains stay bare", async () => {
    const alphaNear = await alphaSampler("central-europe", regionMapFor(LESSONS["central-europe"]));
    const summits: Record<string, [LonLat, number]> = {
      "Gerlachovský štít (High Tatras)": [[20.134, 49.164], 200],
      "Low Tatras": [[19.5, 48.95], 200],
      "Sněžka (Sudetes)": [[15.74, 50.736], 200],
      Grossglockner: [[12.695, 47.075], 200],
      "Babia Góra (Beskids)": [[19.533, 49.583], 150],
      "Bohemian Forest": [[13.383, 49.0], 150],
      "Bieszczady Mountains": [[22.483, 49.283], 45],
      "Fichtelberg (Ore Mountains)": [[12.955, 50.429], 45],
    };
    for (const [name, [p, min]] of Object.entries(summits)) expect(alphaNear(p), name).toBeGreaterThanOrEqual(min);
    for (const range of MOUNTAIN_RANGES.filter((r) => ["ore", "bohemian-forest", "sudetes", "harz"].includes(r.id))) {
      expect(Math.max(...range.crests.flat().map((p) => alphaNear(p))), range.id).toBeGreaterThanOrEqual(45);
    }
    const forests: Record<string, LonLat> = {
      "Białowieża Forest": [23.95, 52.75],
      "Tuchola Forest": [18.0, 53.6],
      Lusatia: [14.726, 51.545],
      "Vienna Woods": [16.0, 48.167],
    };
    for (const [name, p] of Object.entries(forests)) expect(alphaNear(p, 2), name).toBeGreaterThanOrEqual(40);
    // Farmland of Žitný ostrov (the Danubian Lowland) and Kuyavia's black earth, and the Marchfeld; Warsaw and Berlin on low ground.
    for (const [name, p] of Object.entries({ "Žitný ostrov": [17.65, 47.95], Kuyavia: [18.55, 52.7], Marchfeld: [16.64, 48.23] } as Record<string, LonLat>)) {
      expect(alphaNear(p, 0), name).toBeLessThanOrEqual(10);
    }
    for (const [name, p] of Object.entries({ "Warsaw centre": [21.0111, 52.23], "Berlin centre": [13.405, 52.52] } as Record<string, LonLat>)) {
      expect(alphaNear(p, 1), name).toBeLessThanOrEqual(25);
    }
  });

  // Level 4 reaches south to Lampedusa and east to Montenegro. Reference points: the Wikipedia
  // articles' coordinates (checked 2026-10-01; see docs/TERRAIN.md).
  it("Level 4: shows the Julian and Dinaric Alps down to Montenegro, forests from Kočevje to Biogradska Gora; the plains stay bare", async () => {
    const alphaNear = await alphaSampler("along-the-adriatic", regionMapFor(LESSONS["along-the-adriatic"]));
    const summits: Record<string, [LonLat, number]> = {
      "Triglav (Julian Alps)": [[13.837, 46.378], 200],
      "Bobotov Kuk (Durmitor)": [[19.029, 43.127], 200],
      "Maglić (Bosnia and Herzegovina's highest)": [[18.733, 43.283], 200],
      Dinara: [[16.39, 44.064], 200],
      Lovćen: [[18.84, 42.4], 150],
      "Vaganski vrh (Velebit)": [[15.23, 44.533], 150],
    };
    for (const [name, [p, min]] of Object.entries(summits)) expect(alphaNear(p), name).toBeGreaterThanOrEqual(min);
    const forests: Record<string, LonLat> = {
      "Kočevski Rog": [15.0, 45.68],
      "Risnjak (Gorski kotar)": [14.616, 45.42],
      "Perućica (Sutjeska)": [18.7, 43.33],
      "Biogradska Gora": [19.6, 42.9],
    };
    for (const [name, p] of Object.entries(forests)) expect(alphaNear(p, 2), name).toBeGreaterThanOrEqual(40);
    // Open farmland of eastern Slavonia near Vukovar, the Po delta near Ferrara, and the Lomellina's rice fields.
    for (const [name, p] of Object.entries({ "eastern Slavonia": [19.0, 45.25], "Po delta": [11.95, 44.75], Lomellina: [8.66, 45.28] } as Record<string, LonLat>)) {
      expect(alphaNear(p, 0), name).toBeLessThanOrEqual(10);
    }
  });

  // Level 5 reaches north to the Mátra and south to Crete. Reference points: the Wikipedia articles'
  // coordinates (checked 2026-10-02; see docs/TERRAIN.md).
  it("Level 5: shows the Carpathians, the Balkan Mountains, Rila, Pirin, Olympus and Crete's mountains, forests from the Bükk to Strandzha; the plains stay bare", async () => {
    const alphaNear = await alphaSampler("towards-greece", regionMapFor(LESSONS["towards-greece"]));
    const summits: Record<string, [LonLat, number]> = {
      "Moldoveanu (Făgăraș)": [[24.7378, 45.6], 200],
      "Retezat Mountains": [[22.8667, 45.3667], 200],
      "Musala (Rila)": [[23.5853, 42.1797], 200],
      "Vihren (Pirin)": [[23.4008, 41.7678], 200],
      "Botev (Balkan Mountains)": [[24.9167, 42.7175], 200],
      "Mount Olympus": [[22.3586, 40.0856], 200],
      "Smolikas (Pindus)": [[20.9261, 40.0897], 200],
      "Midžor (Serbia–Bulgaria)": [[22.6817, 43.3939], 200],
      "Mount Ida (Crete)": [[24.7725, 35.2267], 150],
      "Apuseni Mountains": [[23.0, 46.5], 150],
      "Kékes (Mátra, Hungary's highest)": [[20.0103, 47.8789], 45],
    };
    for (const [name, [p, min]] of Object.entries(summits)) expect(alphaNear(p), name).toBeGreaterThanOrEqual(min);
    const forests: Record<string, LonLat> = {
      Bükk: [20.5, 48.0833],
      "Fruška Gora": [19.7111, 45.1511],
      Strandzha: [27.6086, 42.0125],
      "Rhodope Mountains": [24.5742, 41.6011],
    };
    for (const [name, p] of Object.entries(forests)) expect(alphaNear(p, 2), name).toBeGreaterThanOrEqual(40);
    // The Great Hungarian Plain (the Hortobágy, Békés), Bačka and the Banat, the Wallachian and Bărăgan
    // plains, Dobruja and the Thessalian plain: open, flat farmland and steppe.
    const open: Record<string, LonLat> = {
      Hortobágy: [21.1, 47.6],
      Békés: [21.0, 46.75],
      Bačka: [19.3333, 46.0],
      Banat: [20.6, 45.6],
      Wallachia: [25.0, 44.2],
      Bărăgan: [27.3, 44.5],
      Dobruja: [28.3333, 44.45],
      "Thessalian plain": [22.25, 39.55],
    };
    for (const [name, p] of Object.entries(open)) expect(alphaNear(p, 0), name).toBeLessThanOrEqual(10);
    expect(alphaNear([26.1039, 44.4325], 1), "Bucharest centre").toBeLessThanOrEqual(25);
  });
  // Level 6 reaches north to the Gulf of Finland. The Baltic states are low and flat (Suur Munamägi,
  // the highest point, is 318 m), so the check is their forests and open farmland. Reference points: the
  // Wikipedia articles' coordinates (checked 2026-10-02; see docs/TERRAIN.md).
  it("Level 6: shows the forests from Augustów and Dzūkija to Lahemaa; the Zemgale plain stays bare", async () => {
    const alphaNear = await alphaSampler("baltic-journey", regionMapFor(LESSONS["baltic-journey"]));
    const forests: Record<string, LonLat> = {
      "Augustów Primeval Forest": [23.3446, 53.8898],
      "Dzūkija National Park": [24.3767, 54.0819],
      "Žemaitija National Park": [21.8889, 56.0486],
      "Soomaa National Park": [25.1056, 58.4408],
      "Lahemaa National Park": [25.8003, 59.5711],
    };
    for (const [name, p] of Object.entries(forests)) expect(alphaNear(p, 2), name).toBeGreaterThanOrEqual(40);
    // Open farmland: the Zemgale plain between Jelgava and Bauska (Latvia), the plain near Joniškis
    // (northern Lithuania) and Kuyavia (Poland, as in Level 3).
    const open: Record<string, LonLat> = { "Zemgale plain": [23.95, 56.5], "Joniškis plain": [23.6, 56.2], Kuyavia: [18.6, 52.75] };
    for (const [name, p] of Object.entries(open)) expect(alphaNear(p, 0), name).toBeLessThanOrEqual(10);
  });
  // Level 7 reaches south and west to Iberia: the Pyrenees (Andorra among them), the Cantabrian Mountains,
  // the Sistema Central, Serra da Estrela and the Sierra Nevada are high and rough; the Meseta's plains, the
  // Tierra de Campos and the Guadalquivir valley are open farmland. Summits: the Wikipedia articles'
  // coordinates (checked 2026-10-03); forest and plain points lie inside those areas (see docs/TERRAIN.md).
  it("Level 7: paints the Pyrenees, Andorra's peaks and the Iberian ranges, the Landes forest; the Meseta's plains stay bare", async () => {
    const alphaNear = await alphaSampler("iberian-journey", regionMapFor(LESSONS["iberian-journey"]));
    const summits: Record<string, LonLat> = {
      "Aneto (Pyrenees)": [0.6578, 42.6314],
      "Coma Pedrosa (Andorra)": [1.4447, 42.5917],
      "Torre de Cerredo (Picos de Europa)": [-4.8519, 43.1972],
      "Torre (Serra da Estrela, Portugal's mainland highest)": [-7.6114, 40.3217],
      "Mulhacén (Sierra Nevada)": [-3.3116, 37.0532],
    };
    for (const [name, p] of Object.entries(summits)) expect(alphaNear(p), name).toBeGreaterThanOrEqual(200);
    // The Landes forest is flat: what shows there is the forest alone.
    const forests: Record<string, LonLat> = { "Landes forest": [-0.9, 44.2], "Serra de Monchique": [-8.55, 37.3], Bussaco: [-8.37, 40.38] };
    for (const [name, p] of Object.entries(forests)) expect(alphaNear(p, 2), name).toBeGreaterThanOrEqual(40);
    const open: Record<string, LonLat> = { "La Mancha": [-3.0, 39.3], "Tierra de Campos": [-5.0, 42.0], "Guadalquivir valley": [-5.6, 37.45] };
    for (const [name, p] of Object.entries(open)) expect(alphaNear(p, 0), name).toBeLessThanOrEqual(10);
  });
});
