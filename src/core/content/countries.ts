import type { LocalizedText } from "../i18n/locales";
import type { CountryContent, CountryId } from "./types";

// Capital and landmark coordinates are rounded city-centre / monument
// positions (WGS84). Sources for coordinates and landmark facts: docs/CONTENT.md.
export const COUNTRIES: Readonly<Record<CountryId, CountryContent>> = {
  FRA: {
    id: "FRA",
    name: { en: "France", hy: "Ֆրանսիա" },
    nameInText: { en: "France", hy: "Ֆրանսիան" },
    capital: { name: { en: "Paris", hy: "Փարիզ" }, coordinates: [2.3522, 48.8566] },
    hint: {
      en: "The largest country in this region, with coasts on the Atlantic and the Mediterranean.",
      hy: "Տարածաշրջանի ամենամեծ երկիրը՝ Ատլանտյան օվկիանոսի և Միջերկրական ծովի ափերով։",
    },
    label: { coordinates: [2.4, 46.7] },
    landmark: {
      id: "eiffel-tower",
      name: { en: "Eiffel Tower", hy: "Էյֆելյան աշտարակ" },
      nameInText: { en: "the Eiffel Tower", hy: "Էյֆելյան աշտարակը" },
      fact: {
        en: "This iron tower was built as the centrepiece of the 1889 World's Fair in Paris.",
        hy: "Այս երկաթե աշտարակը կառուցվել է որպես Փարիզի 1889 թվականի համաշխարհային ցուցահանդեսի գլխավոր կառույց։",
      },
      coordinates: [2.2945, 48.8584],
      illustration: "eiffel-tower",
    },
  },
  BEL: {
    id: "BEL",
    name: { en: "Belgium", hy: "Բելգիա" },
    nameInText: { en: "Belgium", hy: "Բելգիան" },
    capital: { name: { en: "Brussels", hy: "Բրյուսել" }, coordinates: [4.3517, 50.8503] },
    hint: {
      en: "A small country between France and the Netherlands, with a short North Sea coast.",
      hy: "Փոքր երկիր Ֆրանսիայի և Նիդեռլանդների միջև՝ Հյուսիսային ծովի կարճ ափով։",
    },
    label: { coordinates: [4.75, 50.5] },
    landmark: {
      id: "atomium",
      name: { en: "Atomium", hy: "Ատոմիում" },
      nameInText: { en: "the Atomium", hy: "Ատոմիումը" },
      fact: {
        en: "Built for the 1958 World's Fair in Brussels, it shows an iron crystal magnified 165 billion times.",
        hy: "Կառուցվել է Բրյուսելի 1958 թվականի համաշխարհային ցուցահանդեսի համար և պատկերում է երկաթի բյուրեղ՝ 165 միլիարդ անգամ մեծացված։",
      },
      coordinates: [4.3411, 50.8947],
      illustration: "atomium",
    },
  },
  NLD: {
    id: "NLD",
    name: { en: "Netherlands", hy: "Նիդեռլանդներ" },
    nameInText: { en: "the Netherlands", hy: "Նիդեռլանդները" },
    capital: { name: { en: "Amsterdam", hy: "Ամստերդամ" }, coordinates: [4.9041, 52.3676] },
    hint: {
      en: "A low-lying country on the North Sea, just north of Belgium.",
      hy: "Ցածրադիր երկիր Հյուսիսային ծովի ափին՝ Բելգիայից անմիջապես հյուսիս։",
    },
    label: { coordinates: [5.75, 52.2] },
    landmark: {
      id: "amsterdam-canal-houses",
      name: { en: "Amsterdam canal houses", hy: "Ամստերդամի ջրանցքների տները" },
      nameInText: { en: "Amsterdam's canal houses", hy: "Ամստերդամի ջրանցքների տները" },
      fact: {
        en: "They line Amsterdam's 17th-century canal ring, a UNESCO World Heritage Site since 2010.",
        hy: "Դրանք շարված են Ամստերդամի 17-րդ դարի ջրանցքների օղակի երկայնքով, որը 2010 թվականից ՅՈՒՆԵՍԿՕ-ի համաշխարհային ժառանգության մաս է։",
      },
      // A group of buildings along several canals, not one place: no map pin.
      illustration: "amsterdam-canal-houses",
    },
  },
  LUX: {
    id: "LUX",
    name: { en: "Luxembourg", hy: "Լյուքսեմբուրգ" },
    nameInText: { en: "Luxembourg", hy: "Լյուքսեմբուրգը" },
    capital: { name: { en: "Luxembourg City", hy: "Լյուքսեմբուրգ" }, coordinates: [6.1319, 49.6116] },
    hint: {
      en: "A tiny landlocked country where France, Belgium and Germany meet.",
      hy: "Փոքրիկ երկիր առանց ծովի, որտեղ հանդիպում են Ֆրանսիան, Բելգիան և Գերմանիան։",
    },
    // Too small for an in-place label in Level 1 (its `smallCountries`): drawn beside the country with a leader line.
    label: { coordinates: [6.1, 49.72] },
    landmark: {
      id: "adolphe-bridge",
      name: { en: "Adolphe Bridge", hy: "Ադոլֆի կամուրջ" },
      nameInText: { en: "the Adolphe Bridge", hy: "Ադոլֆի կամուրջը" },
      fact: {
        en: "Opened in 1903, its 85-metre stone arch spans the Pétrusse valley in Luxembourg City.",
        hy: "Բացվել է 1903 թվականին։ Նրա 85 մետրանոց քարե կամարը ձգվում է Պետրյուսի հովտի վրայով՝ Լյուքսեմբուրգ քաղաքում։",
      },
      coordinates: [6.127, 49.6083],
      illustration: "adolphe-bridge",
    },
  },
  DEU: {
    id: "DEU",
    name: { en: "Germany", hy: "Գերմանիա" },
    nameInText: { en: "Germany", hy: "Գերմանիան" },
    capital: { name: { en: "Berlin", hy: "Բեռլին" }, coordinates: [13.405, 52.52] },
    hint: {
      en: "The large country in the east of this region, reaching both the North Sea and the Baltic Sea.",
      hy: "Տարածաշրջանի արևելյան մասի մեծ երկիրը, որը հասնում է և՛ Հյուսիսային, և՛ Բալթիկ ծովերին։",
    },
    label: { coordinates: [10.3, 51.1] },
    landmark: {
      id: "brandenburg-gate",
      name: { en: "Brandenburg Gate", hy: "Բրանդենբուրգյան դարպասներ" },
      nameInText: { en: "the Brandenburg Gate", hy: "Բրանդենբուրգյան դարպասները" },
      fact: {
        en: "Completed in 1791 in Berlin, it is crowned by the Quadriga, a bronze chariot drawn by four horses.",
        hy: "Ավարտվել է 1791 թվականին Բեռլինում։ Գագաթին Կվադրիգան է՝ չորս ձիերով լծված բրոնզե մարտակառք։",
      },
      coordinates: [13.3777, 52.5163],
      illustration: "brandenburg-gate",
    },
  },
  CHE: {
    id: "CHE",
    name: { en: "Switzerland", hy: "Շվեյցարիա" },
    nameInText: { en: "Switzerland", hy: "Շվեյցարիան" },
    // Officially the "federal city", Bern is Switzerland's de facto capital (docs/CONTENT.md).
    capital: { name: { en: "Bern", hy: "Բեռն" }, coordinates: [7.4475, 46.9481] },
    hint: {
      en: "A small mountain country in the Alps, with no coast, between France, Germany, Austria and Italy.",
      hy: "Փոքր լեռնային երկիր Ալպերում՝ առանց ծովի, Ֆրանսիայի, Գերմանիայի, Ավստրիայի և Իտալիայի միջև։",
    },
    label: { coordinates: [8.2, 46.8] },
    landmark: {
      id: "chapel-bridge",
      name: { en: "Chapel Bridge", hy: "Մատուռի կամուրջ" },
      nameInText: { en: "the Chapel Bridge", hy: "Մատուռի կամուրջը" },
      fact: {
        en: "A covered wooden bridge from the 1300s in Lucerne, rebuilt in just eight months after a fire in 1993.",
        hy: "Լյուցեռնի ծածկած փայտե կամուրջը կառուցվել է 1300-ական թվականներին, իսկ 1993 թվականի հրդեհից հետո վերակառուցվել է ընդամենը ութ ամսում։",
      },
      coordinates: [8.3075, 47.0517],
      illustration: "chapel-bridge",
    },
  },
  AUT: {
    id: "AUT",
    name: { en: "Austria", hy: "Ավստրիա" },
    nameInText: { en: "Austria", hy: "Ավստրիան" },
    capital: { name: { en: "Vienna", hy: "Վիեննա" }, coordinates: [16.3725, 48.2083] },
    hint: {
      en: "A mountain country with no coast in the east of this region, just south of Germany.",
      hy: "Լեռնային երկիր առանց ծովի՝ տարածաշրջանի արևելքում, Գերմանիայից անմիջապես հարավ։",
    },
    label: { coordinates: [14.4, 47.6] },
    landmark: {
      id: "schonbrunn-palace",
      name: { en: "Schönbrunn Palace", hy: "Շյոնբրունի պալատ" },
      nameInText: { en: "Schönbrunn Palace", hy: "Շյոնբրունի պալատը" },
      fact: {
        en: "The Habsburg emperors' summer palace in Vienna. Its zoo, opened in 1752, is the oldest still open.",
        hy: "Հաբսբուրգ կայսրերի ամառային պալատը Վիեննայում։ Նրա կենդանաբանական այգին, որը բացվել է 1752 թվականին, աշխարհի ամենահին գործող կենդանաբանական այգին է։",
      },
      coordinates: [16.3119, 48.1845],
      illustration: "schonbrunn-palace",
    },
  },
  ITA: {
    id: "ITA",
    name: { en: "Italy", hy: "Իտալիա" },
    nameInText: { en: "Italy", hy: "Իտալիան" },
    capital: { name: { en: "Rome", hy: "Հռոմ" }, coordinates: [12.4828, 41.8933] },
    hint: {
      en: "A long, boot-shaped peninsula reaching into the Mediterranean Sea, south of the Alps.",
      hy: "Երկար, կոշիկաձև թերակղզի, որը ձգվում է Միջերկրական ծովի մեջ՝ Ալպերից հարավ։",
    },
    label: { coordinates: [13.0, 42.6] },
    landmark: {
      id: "colosseum",
      name: { en: "Colosseum", hy: "Կոլիզեում" },
      nameInText: { en: "the Colosseum", hy: "Կոլիզեումը" },
      fact: {
        en: "Opened in AD 80, this Roman amphitheatre could hold about 50,000 spectators.",
        hy: "Բացվել է մ.թ. 80 թվականին։ Հռոմեական այս ամֆիթատրոնը կարող էր տեղավորել մոտ 50 000 հանդիսատես։",
      },
      coordinates: [12.4922, 41.8903],
      illustration: "colosseum",
    },
  },
};

/** A country's hint in a level: the level's own wording for its region, or the country's. */
export function countryHint(lesson: { hints?: Partial<Readonly<Record<CountryId, LocalizedText>>> }, id: CountryId): LocalizedText {
  return lesson.hints?.[id] ?? getCountry(id).hint;
}

export function getCountry(id: CountryId): CountryContent {
  const country = COUNTRIES[id];
  if (!country) throw new Error(`Unknown country id: ${id}`);
  return country;
}
