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
  // Level 3's new countries.
  POL: {
    id: "POL",
    name: { en: "Poland", hy: "Լեհաստան" },
    nameInText: { en: "Poland", hy: "Լեհաստանը" },
    capital: { name: { en: "Warsaw", hy: "Վարշավա" }, coordinates: [21.0111, 52.23] },
    hint: {
      en: "A large, mostly flat country in the north-east of this region, with a coast on the Baltic Sea.",
      hy: "Մեծ, հիմնականում հարթ երկիր տարածաշրջանի հյուսիս-արևելքում՝ Բալթիկ ծովի ափով։",
    },
    label: { coordinates: [19.4, 52.1] },
    landmark: {
      id: "wawel-castle",
      name: { en: "Wawel Castle", hy: "Վավելի ամրոց" },
      nameInText: { en: "Wawel Castle", hy: "Վավելի ամրոցը" },
      fact: {
        en: "For centuries the home of Poland's kings, it stands on a hill above the Vistula River in Kraków.",
        hy: "Դարեր շարունակ եղել է Լեհաստանի թագավորների նստավայրը։ Այն կանգնած է Կրակովում՝ Վիսլա գետի ափին գտնվող բլրի վրա։",
      },
      // In Kraków, not the capital.
      coordinates: [19.9347, 50.0539],
      illustration: "wawel-castle",
    },
  },
  CZE: {
    id: "CZE",
    name: { en: "Czechia", hy: "Չեխիա" },
    nameInText: { en: "Czechia", hy: "Չեխիան" },
    capital: { name: { en: "Prague", hy: "Պրահա" }, coordinates: [14.4214, 50.0875] },
    hint: {
      en: "A country with no coast in the middle of this region, almost ringed by low mountains.",
      hy: "Երկիր առանց ծովի՝ տարածաշրջանի կենտրոնում, գրեթե ամբողջությամբ շրջապատված ցածր լեռներով։",
    },
    label: { coordinates: [15.4, 49.8] },
    landmark: {
      id: "charles-bridge",
      name: { en: "Charles Bridge", hy: "Կառլի կամուրջ" },
      nameInText: { en: "the Charles Bridge", hy: "Կառլի կամուրջը" },
      fact: {
        en: "Begun in 1357, this stone bridge was Prague's only way across the Vltava River until 1841.",
        hy: "Կառուցումը սկսվել է 1357 թվականին։ Մինչև 1841 թվականը այս քարե կամուրջը Պրահայում Վլտավա գետն անցնելու միակ ճանապարհն էր։",
      },
      coordinates: [14.4119, 50.0864],
      illustration: "charles-bridge",
    },
  },
  SVK: {
    id: "SVK",
    name: { en: "Slovakia", hy: "Սլովակիա" },
    nameInText: { en: "Slovakia", hy: "Սլովակիան" },
    capital: { name: { en: "Bratislava", hy: "Բրատիսլավա" }, coordinates: [17.1097, 48.1439] },
    hint: {
      en: "A small mountain country with no coast in the south-east of this region, just south of Poland.",
      hy: "Փոքր լեռնային երկիր առանց ծովի՝ տարածաշրջանի հարավ-արևելքում, Լեհաստանից անմիջապես հարավ։",
    },
    label: { coordinates: [19.5, 48.75] },
    landmark: {
      id: "bratislava-castle",
      name: { en: "Bratislava Castle", hy: "Բրատիսլավայի ամրոց" },
      nameInText: { en: "Bratislava Castle", hy: "Բրատիսլավայի ամրոցը" },
      fact: {
        en: "This rectangular castle with four corner towers stands on a rocky hill above the Danube.",
        hy: "Չորս անկյունային աշտարակներով այս ուղղանկյուն ամրոցը կանգնած է ժայռոտ բլրի վրա՝ Դանուբ գետի վերևում։",
      },
      coordinates: [17.1, 48.1422],
      illustration: "bratislava-castle",
    },
  },
  // Level 4's new countries, each with its own landmark illustration (docs/CONTENT.md).
  SVN: {
    id: "SVN",
    name: { en: "Slovenia", hy: "Սլովենիա" },
    nameInText: { en: "Slovenia", hy: "Սլովենիան" },
    capital: { name: { en: "Ljubljana", hy: "Լյուբլյանա" }, coordinates: [14.5061, 46.0514] },
    hint: {
      en: "A small country where the Alps meet the Adriatic, with a short coast just east of Italy.",
      hy: "Փոքր երկիր, որտեղ Ալպերը հասնում են Ադրիատիկին՝ կարճ ծովափով, Իտալիայից անմիջապես արևելք։",
    },
    label: { coordinates: [14.85, 46.1] },
    landmark: {
      id: "bled-castle",
      name: { en: "Bled Castle", hy: "Բլեդի ամրոց" },
      nameInText: { en: "Bled Castle", hy: "Բլեդի ամրոցը" },
      fact: {
        en: "Perched on a 130-metre cliff above Lake Bled, it was first mentioned in writing in 1011.",
        hy: "Կանգնած է Բլեդ լճի վերևում՝ 130 մետրանոց ժայռի վրա։ Առաջին անգամ գրավոր հիշատակվել է 1011 թվականին։",
      },
      // At Lake Bled, not the capital.
      coordinates: [14.1005, 46.3697],
      illustration: "bled-castle",
    },
  },
  HRV: {
    id: "HRV",
    name: { en: "Croatia", hy: "Խորվաթիա" },
    nameInText: { en: "Croatia", hy: "Խորվաթիան" },
    capital: { name: { en: "Zagreb", hy: "Զագրեբ" }, coordinates: [15.9775, 45.8131] },
    hint: {
      en: "A crescent-shaped country with a long Adriatic coast and many islands, curving around Bosnia and Herzegovina.",
      hy: "Մահիկաձև երկիր Ադրիատիկի երկար ափով և բազմաթիվ կղզիներով, որը աղեղով շրջապատում է Բոսնիա և Հերցեգովինան։",
    },
    label: { coordinates: [16.6, 45.45] },
    landmark: {
      id: "dubrovnik-city-walls",
      name: { en: "City Walls of Dubrovnik", hy: "Դուբրովնիկի պարիսպներ" },
      nameInText: { en: "the city walls of Dubrovnik", hy: "Դուբրովնիկի պարիսպները" },
      fact: {
        en: "Almost 2 kilometres long, with towers and fortresses, these walls ring Dubrovnik's old town.",
        hy: "Մոտ 2 կիլոմետր երկարությամբ այս պարիսպներն իրենց աշտարակներով և ամրոցներով օղակում են Դուբրովնիկի հին քաղաքը։",
      },
      // In Dubrovnik, in Croatia's far south (cut off from the rest by Bosnia and
      // Herzegovina's coast at Neum), not the capital. The point is the Minčeta Tower.
      coordinates: [18.1084, 42.643],
      illustration: "dubrovnik-city-walls",
    },
  },
  BIH: {
    id: "BIH",
    name: { en: "Bosnia and Herzegovina", hy: "Բոսնիա և Հերցեգովինա" },
    nameInText: { en: "Bosnia and Herzegovina", hy: "Բոսնիա և Հերցեգովինան" },
    capital: { name: { en: "Sarajevo", hy: "Սարաևո" }, coordinates: [18.4131, 43.8564] },
    hint: {
      en: "A mountainous country between Croatia and Montenegro, whose only coast, at Neum, is about 20 km long.",
      hy: "Լեռնային երկիր Խորվաթիայի և Չեռնոգորիայի միջև, որի միակ ծովափը՝ Նեումի մոտ, ընդամենը մոտ 20 կմ է։",
    },
    label: { coordinates: [17.85, 44.25] },
    landmark: {
      id: "stari-most",
      name: { en: "Stari Most", hy: "Մոստարի կամուրջ" },
      nameInText: { en: "Stari Most", hy: "Մոստարի կամուրջը" },
      fact: {
        en: "Mostar's “Old Bridge”, a stone arch over the Neretva from 1566, was destroyed in 1993 and rebuilt in 2004.",
        hy: "Մոստարի «Հին կամուրջը»՝ Ներետվա գետի վրա 1566 թվականին կառուցված քարե կամարը, ավերվել է 1993-ին և վերակառուցվել 2004 թվականին։",
      },
      // In Mostar, not the capital.
      coordinates: [17.8151, 43.3373],
      illustration: "stari-most",
    },
  },
  MNE: {
    id: "MNE",
    name: { en: "Montenegro", hy: "Չեռնոգորիա" },
    nameInText: { en: "Montenegro", hy: "Չեռնոգորիան" },
    // Podgorica is the capital (Constitution, Art. 5); Cetinje is the "Old Royal Capital".
    capital: { name: { en: "Podgorica", hy: "Պոդգորիցա" }, coordinates: [19.2628, 42.4414] },
    hint: {
      en: "A small mountainous country on the Adriatic in the south-east of this region, south of Bosnia and Herzegovina.",
      hy: "Փոքր լեռնային երկիր Ադրիատիկի ափին՝ տարածաշրջանի հարավ-արևելքում, Բոսնիա և Հերցեգովինայից հարավ։",
    },
    label: { coordinates: [19.25, 42.85] },
    landmark: {
      id: "ostrog-monastery",
      name: { en: "Ostrog Monastery", hy: "Օստրոգի վանք" },
      nameInText: { en: "Ostrog Monastery", hy: "Օստրոգի վանքը" },
      fact: {
        en: "Founded in the 17th century, it is built into an almost vertical cliff 900 metres above sea level.",
        hy: "Հիմնադրվել է 17-րդ դարում և կառուցված է գրեթե ուղղահայաց ժայռի մեջ՝ ծովի մակարդակից 900 մետր բարձրության վրա։",
      },
      // The upper monastery, north-west of Podgorica, not in the capital.
      coordinates: [19.0306, 42.6747],
      illustration: "ostrog-monastery",
    },
  },
  // Level 5's countries.
  HUN: {
    id: "HUN",
    name: { en: "Hungary", hy: "Հունգարիա" },
    nameInText: { en: "Hungary", hy: "Հունգարիան" },
    capital: { name: { en: "Budapest", hy: "Բուդապեշտ" }, coordinates: [19.0514, 47.4925] },
    hint: {
      en: "A country with no coast in the north-west of this region, on wide plains crossed by the Danube.",
      hy: "Երկիր առանց ծովի՝ տարածաշրջանի հյուսիս-արևմուտքում, լայն հարթավայրերով, որոնցով հոսում է Դանուբը։",
    },
    label: { coordinates: [19.5, 47.1] },
    landmark: {
      id: "esztergom-basilica",
      name: { en: "Esztergom Basilica", hy: "Էստերգոմի բազիլիկ" },
      nameInText: { en: "Esztergom Basilica", hy: "Էստերգոմի բազիլիկը" },
      fact: {
        en: "Completed in 1869, Hungary's largest church rises 100 metres from its crypt to the top of its dome.",
        hy: "Հունգարիայի ամենամեծ եկեղեցին ավարտվել է 1869 թվականին։ Ստորին եկեղեցուց մինչև գմբեթի գագաթը նրա բարձրությունը 100 մետր է։",
      },
      // In Esztergom, on the Danube north-west of Budapest, not the capital.
      coordinates: [18.7364, 47.7989],
      illustration: "esztergom-basilica",
    },
  },
  ROU: {
    id: "ROU",
    name: { en: "Romania", hy: "Ռումինիա" },
    nameInText: { en: "Romania", hy: "Ռումինիան" },
    capital: { name: { en: "Bucharest", hy: "Բուխարեստ" }, coordinates: [26.1039, 44.4325] },
    hint: {
      en: "The largest country in this region, with the arc of the Carpathians and a coast on the Black Sea.",
      hy: "Տարածաշրջանի ամենամեծ երկիրը՝ Կարպատների աղեղով և Սև ծովի ափով։",
    },
    label: { coordinates: [24.9, 45.95] },
    landmark: {
      id: "bran-castle",
      name: { en: "Bran Castle", hy: "Բրանի դղյակ" },
      nameInText: { en: "Bran Castle", hy: "Բրանի դղյակը" },
      fact: {
        en: "Begun in 1377 on a rock above a mountain pass, it guarded the road into Transylvania.",
        hy: "Կառուցումը սկսվել է 1377 թվականին՝ լեռնանցքի վերևում գտնվող ժայռի վրա։ Այն հսկում էր դեպի Տրանսիլվանիա տանող ճանապարհը։",
      },
      // Near Brașov, in the Carpathians, not the capital.
      coordinates: [25.3672, 45.515],
      illustration: "bran-castle",
    },
  },
  SRB: {
    id: "SRB",
    name: { en: "Serbia", hy: "Սերբիա" },
    nameInText: { en: "Serbia", hy: "Սերբիան" },
    capital: { name: { en: "Belgrade", hy: "Բելգրադ" }, coordinates: [20.4569, 44.8178] },
    hint: {
      en: "A country with no coast in the west of this region, just south of Hungary.",
      hy: "Երկիր առանց ծովի՝ տարածաշրջանի արևմուտքում, Հունգարիայից անմիջապես հարավ։",
    },
    label: { coordinates: [20.85, 44.05] },
    landmark: {
      id: "golubac-fortress",
      name: { en: "Golubac Fortress", hy: "Գոլուբաց ամրոց" },
      nameInText: { en: "Golubac Fortress", hy: "Գոլուբաց ամրոցը" },
      fact: {
        en: "First mentioned in 1335, it guards the Danube where the river enters the Iron Gates gorge.",
        hy: "Առաջին անգամ հիշատակվել է 1335 թվականին։ Այն հսկում է Դանուբն այնտեղ, որտեղ գետը մտնում է Երկաթե դարպասների կիրճը։",
      },
      // On the Danube, east of Belgrade, not the capital.
      coordinates: [21.6785, 44.6612],
      illustration: "golubac-fortress",
    },
  },
  BGR: {
    id: "BGR",
    name: { en: "Bulgaria", hy: "Բուլղարիա" },
    nameInText: { en: "Bulgaria", hy: "Բուլղարիան" },
    capital: { name: { en: "Sofia", hy: "Սոֆիա" }, coordinates: [23.3242, 42.6975] },
    hint: {
      en: "A country on the Black Sea, between the Danube in the north and Greece in the south.",
      hy: "Երկիր Սև ծովի ափին՝ հյուսիսում Դանուբի և հարավում Հունաստանի միջև։",
    },
    label: { coordinates: [25.2, 42.75] },
    landmark: {
      id: "rila-monastery",
      name: { en: "Rila Monastery", hy: "Ռիլայի վանք" },
      nameInText: { en: "Rila Monastery", hy: "Ռիլայի վանքը" },
      fact: {
        en: "Founded in the 10th century by the hermit John of Rila; after a fire it was rebuilt in 1834–1862.",
        hy: "Հիմնադրել է ճգնավոր Հովհաննես Ռիլայեցին 10-րդ դարում։ Հրդեհից հետո այն վերակառուցվել է 1834–1862 թվականներին։",
      },
      // In the Rila Mountains, south of Sofia, not the capital.
      coordinates: [23.3403, 42.1333],
      illustration: "rila-monastery",
    },
  },
  GRC: {
    id: "GRC",
    name: { en: "Greece", hy: "Հունաստան" },
    nameInText: { en: "Greece", hy: "Հունաստանը" },
    capital: { name: { en: "Athens", hy: "Աթենք" }, coordinates: [23.7281, 37.9842] },
    hint: {
      en: "The southernmost country of this region: a mountainous peninsula with many islands.",
      hy: "Տարածաշրջանի ամենահարավային երկիրը՝ բազմաթիվ կղզիներով լեռնային թերակղզի։",
    },
    label: { coordinates: [21.95, 39.45] },
    landmark: {
      id: "meteora",
      name: { en: "Meteora", hy: "Մետեորա" },
      nameInText: { en: "Meteora", hy: "Մետեորան" },
      fact: {
        en: "Monks settled on these sandstone pillars from the 11th century; 24 monasteries were built on them.",
        hy: "11-րդ դարից վանականները բնակություն են հաստատել այս ավազաքարե ժայռասյուների վրա, որտեղ կառուցվել է 24 վանք։",
      },
      // The Monastery of Great Meteoron, in Thessaly, not the capital.
      coordinates: [21.6244, 39.7239],
      illustration: "meteora",
    },
  },
  // Level 6's new countries (Germany and Poland are shared with earlier levels), each with
  // its own illustration (supplied 2026-10-03).
  LTU: {
    id: "LTU",
    name: { en: "Lithuania", hy: "Լիտվա" },
    nameInText: { en: "Lithuania", hy: "Լիտվան" },
    capital: { name: { en: "Vilnius", hy: "Վիլնյուս" }, coordinates: [25.28, 54.6872] },
    hint: {
      en: "A country with a short coast on the Baltic Sea, between Poland and Latvia.",
      hy: "Երկիր Բալթիկ ծովի կարճ ափով՝ Լեհաստանի և Լատվիայի միջև։",
    },
    label: { coordinates: [23.9, 55.35] },
    landmark: {
      id: "trakai-island-castle",
      name: { en: "Trakai Island Castle", hy: "Տրակայի կղզու դղյակ" },
      nameInText: { en: "Trakai Island Castle", hy: "Տրակայի կղզու դղյակը" },
      fact: {
        // A word joiner (U+2060) after each dash or hyphen of a range keeps it on one line.
        en: "Built in the 14th–\u206015th centuries on an island in Lake Galvė, it was home to Lithuania's Grand Dukes.",
        hy: "Կառուցվել է 14–\u206015-\u2060րդ դարերում Գալվե լճի կղզիներից մեկի վրա և եղել է Լիտվայի մեծ իշխանների նստավայրը։",
      },
      // In Trakai, west of Vilnius, not the capital.
      coordinates: [24.9331, 54.6525],
      illustration: "trakai-island-castle",
    },
  },
  LVA: {
    id: "LVA",
    name: { en: "Latvia", hy: "Լատվիա" },
    nameInText: { en: "Latvia", hy: "Լատվիան" },
    capital: { name: { en: "Riga", hy: "Ռիգա" }, coordinates: [24.1064, 56.9489] },
    hint: {
      en: "A country on the Baltic Sea between Lithuania and Estonia, around the Gulf of Riga.",
      hy: "Երկիր Բալթիկ ծովի ափին՝ Լիտվայի և Էստոնիայի միջև, Ռիգայի ծոցի շուրջը։",
    },
    label: { coordinates: [25.9, 56.75] },
    landmark: {
      id: "house-of-the-black-heads",
      name: { en: "House of the Black Heads", hy: "Սևագլուխների տուն" },
      nameInText: { en: "the House of the Black Heads", hy: "Սևագլուխների տունը" },
      fact: {
        en: "Named after a brotherhood of merchants, it was destroyed in the Second World War and rebuilt in 1999.",
        hy: "Անվանվել է առևտրականների եղբայրության անունով։ Ավերվել է Երկրորդ համաշխարհային պատերազմի ժամանակ և վերակառուցվել 1999 թվականին։",
      },
      // On Town Hall Square in Riga's old town, 0.2 km from the capital's point: the marker
      // rule leaves its pin out wherever the two would meet (docs/CONTENT.md).
      coordinates: [24.1069, 56.9472],
      illustration: "house-of-the-black-heads",
    },
  },
  EST: {
    id: "EST",
    name: { en: "Estonia", hy: "Էստոնիա" },
    nameInText: { en: "Estonia", hy: "Էստոնիան" },
    capital: { name: { en: "Tallinn", hy: "Տալլին" }, coordinates: [24.7535, 59.437] },
    hint: {
      en: "The northernmost country of this region, on the Gulf of Finland, with many islands.",
      hy: "Տարածաշրջանի ամենահյուսիսային երկիրը՝ Ֆիննական ծոցի ափին, բազմաթիվ կղզիներով։",
    },
    label: { coordinates: [25.9, 58.75] },
    landmark: {
      id: "tallinn-town-hall",
      name: { en: "Tallinn Town Hall", hy: "Տալլինի ռատուշա" },
      nameInText: { en: "Tallinn Town Hall", hy: "Տալլինի ռատուշան" },
      fact: {
        // A word joiner (U+2060) after the dash keeps the years on one line.
        en: "Built in its present form in 1402–\u20601404, it is the only surviving Gothic town hall in Northern Europe.",
        hy: "Ներկայիս տեսքը ստացել է 1402–\u20601404 թվականներին։ Այն Հյուսիսային Եվրոպայում պահպանված միակ գոթական ռատուշան է։",
      },
      // On Town Hall Square in Tallinn's old town, 0.5 km from the capital's point: the marker
      // rule leaves its pin out wherever the two would meet (docs/CONTENT.md).
      coordinates: [24.7455, 59.4371],
      illustration: "tallinn-town-hall",
    },
  },
  // Level 7's new countries (France and Italy are shared with earlier levels), each with
  // its own illustration (supplied 2026-10-04).
  PRT: {
    id: "PRT",
    name: { en: "Portugal", hy: "Պորտուգալիա" },
    nameInText: { en: "Portugal", hy: "Պորտուգալիան" },
    capital: { name: { en: "Lisbon", hy: "Լիսաբոն" }, coordinates: [-9.15, 38.7253] },
    hint: {
      en: "The westernmost country of this region, with a long coast on the Atlantic Ocean.",
      hy: "Տարածաշրջանի ամենաարևմտյան երկիրը՝ Ատլանտյան օվկիանոսի երկար ափով։",
    },
    // In the Alentejo, south of the middle: on a phone the open close-up (top-left in Level 7) covers
    // Portugal's north, and a name whose leader dot is under it is left out.
    label: { coordinates: [-8.0, 38.6] },
    landmark: {
      id: "belem-tower",
      name: { en: "Belém Tower", hy: "Բելեմի աշտարակ" },
      nameInText: { en: "Belém Tower", hy: "Բելեմի աշտարակը" },
      fact: {
        // A word joiner (U+2060) after the dash keeps the years on one line.
        en: "Built in 1514–\u20601519 as a fortress on the Tagus, it defended the entrance to Lisbon's harbour.",
        hy: "Կառուցվել է 1514–\u20601519 թվականներին Տախո գետի ափին՝ որպես Լիսաբոնի նավահանգստի մուտքը պաշտպանող ամրոց։",
      },
      // In Belém, on the Tagus west of the city centre, 6 km from the capital's point.
      coordinates: [-9.2161, 38.6917],
      illustration: "belem-tower",
    },
  },
  ESP: {
    id: "ESP",
    name: { en: "Spain", hy: "Իսպանիա" },
    nameInText: { en: "Spain", hy: "Իսպանիան" },
    capital: { name: { en: "Madrid", hy: "Մադրիդ" }, coordinates: [-3.7033, 40.4169] },
    hint: {
      en: "A large country covering most of the Iberian Peninsula, between Portugal and France.",
      hy: "Մեծ երկիր, որը զբաղեցնում է Պիրենեյան թերակղզու մեծ մասը՝ Պորտուգալիայի և Ֆրանսիայի միջև։",
    },
    label: { coordinates: [-3.6, 39.6] },
    landmark: {
      id: "sagrada-familia",
      name: { en: "Sagrada Família", hy: "Սագրադա Ֆամիլիա" },
      nameInText: { en: "the Sagrada Família", hy: "Սագրադա Ֆամիլիան" },
      fact: {
        en: "Antoni Gaudí took over its design in 1883 and from 1914 worked on nothing else until his death in 1926.",
        hy: "Անտոնիո Գաուդին ստանձնել է դրա նախագիծը 1883 թվականին, իսկ 1914-\u2060ից մինչև իր մահը՝ 1926 թվականը, աշխատել է միայն դրա վրա։",
      },
      // In Barcelona, not the capital.
      coordinates: [2.1743, 41.4037],
      illustration: "sagrada-familia",
    },
  },
  AND: {
    id: "AND",
    name: { en: "Andorra", hy: "Անդորրա" },
    nameInText: { en: "Andorra", hy: "Անդորրան" },
    capital: { name: { en: "Andorra la Vella", hy: "Անդորրա լա Վելյա" }, coordinates: [1.5217, 42.5061] },
    hint: {
      en: "A tiny landlocked country high in the Pyrenees, between Spain and France.",
      hy: "Փոքրիկ երկիր առանց ծովի՝ Պիրենեյան լեռներում, Իսպանիայի և Ֆրանսիայի միջև։",
    },
    // Too small for an in-place label in Level 7 (its `smallCountries`): drawn beside the country with a leader line.
    label: { coordinates: [1.58, 42.55] },
    landmark: {
      id: "casa-de-la-vall",
      name: { en: "Casa de la Vall", hy: "Կասա դե լա Վալ" },
      nameInText: { en: "Casa de la Vall", hy: "Կասա դե լա Վալը" },
      fact: {
        // A word joiner (U+2060) after each dash or hyphen keeps the years and the century on one line.
        en: "Built as a family manor house in the late 16th century, it housed Andorra's parliament from 1702 to 2011.",
        hy: "Կառուցվել է 16-\u2060րդ դարի վերջին որպես ընտանեկան կալվածատուն, իսկ 1702–\u20602011 թվականներին եղել է Անդորրայի խորհրդարանի նստավայրը։",
      },
      // In Andorra la Vella's old quarter, 0.1 km from the capital's point: the marker
      // rule leaves its pin out wherever the two would meet (docs/CONTENT.md).
      coordinates: [1.5206, 42.5067],
      illustration: "casa-de-la-vall",
    },
  },
  // Level 8's new countries. Their landmarks have no illustration yet: the cards show
  // them as text (docs/CONTENT.md, "Level 8: Eastern Europe", has the briefs).
  BLR: {
    id: "BLR",
    name: { en: "Belarus", hy: "Բելառուս" },
    nameInText: { en: "Belarus", hy: "Բելառուսը" },
    capital: { name: { en: "Minsk", hy: "Մինսկ" }, coordinates: [27.5586, 53.9006] },
    hint: {
      en: "A flat country with no coast in the north of this region, with many forests, lakes and marshes.",
      hy: "Հարթ երկիր առանց ծովի՝ տարածաշրջանի հյուսիսում, բազմաթիվ անտառներով, լճերով և ճահիճներով։",
    },
    label: { coordinates: [28.0, 53.25] },
    landmark: {
      id: "mir-castle",
      name: { en: "Mir Castle", hy: "Միրի ամրոց" },
      nameInText: { en: "Mir Castle", hy: "Միրի ամրոցը" },
      fact: {
        // A word joiner (U+2060) after the hyphen keeps the century on one line.
        en: "Begun in Gothic style in the late 15th century, it was later rebuilt in Renaissance and Baroque styles.",
        hy: "Կառուցումը սկսվել է 15-\u2060րդ դարի վերջին՝ գոթական ոճով, իսկ հետագայում ամրոցը վերակառուցվել է վերածննդի և բարոկկո ոճերով։",
      },
      // In the village of Mir, about 85 km south-west of Minsk.
      coordinates: [26.4727, 53.4511],
    },
  },
  UKR: {
    id: "UKR",
    name: { en: "Ukraine", hy: "Ուկրաինա" },
    nameInText: { en: "Ukraine", hy: "Ուկրաինան" },
    capital: { name: { en: "Kyiv", hy: "Կիև" }, coordinates: [30.5233, 50.45] },
    hint: {
      en: "The largest country in this region, with a long coast on the Black Sea and the Sea of Azov.",
      hy: "Տարածաշրջանի ամենամեծ երկիրը՝ Սև ծովի և Ազովի ծովի երկար ափով։",
    },
    label: { coordinates: [31.9, 48.75] },
    landmark: {
      id: "saint-sophia-cathedral",
      name: { en: "Saint Sophia Cathedral", hy: "Սուրբ Սոֆիայի տաճար" },
      nameInText: { en: "Saint Sophia Cathedral", hy: "Սուրբ Սոֆիայի տաճարը" },
      fact: {
        en: "Built in the early 11th century to rival Hagia Sophia in Constantinople, it keeps mosaics from that time.",
        hy: "Կառուցվել է 11-\u2060րդ դարի սկզբին՝ Կոստանդնուպոլսի Սուրբ Սոֆիայի տաճարի հետ մրցելու համար, և պահպանում է այդ ժամանակի խճանկարները։",
      },
      // In Kyiv's historic centre, 0.6 km from the capital's point: the marker rule
      // leaves its pin out wherever the two would meet (docs/CONTENT.md).
      coordinates: [30.5144, 50.4528],
    },
  },
  MDA: {
    id: "MDA",
    name: { en: "Moldova", hy: "Մոլդովա" },
    nameInText: { en: "Moldova", hy: "Մոլդովան" },
    // "Chisinau", without the Romanian ș and ă: the spelling of the CIA World Factbook and the
    // UN, and drawn in the app's own font (docs/CONTENT.md, "Level 8").
    capital: { name: { en: "Chisinau", hy: "Քիշնև" }, coordinates: [28.8353, 47.0228] },
    hint: {
      en: "A small country with no coast, between Romania and Ukraine.",
      hy: "Փոքր երկիր առանց ծովի՝ Ռումինիայի և Ուկրաինայի միջև։",
    },
    label: { coordinates: [28.45, 47.55] },
    landmark: {
      id: "soroca-fortress",
      name: { en: "Soroca Fortress", hy: "Սորոկիի ամրոց" },
      nameInText: { en: "Soroca Fortress", hy: "Սորոկիի ամրոցը" },
      fact: {
        // A word joiner (U+2060) after the hyphen keeps the century on one line.
        en: "Rebuilt in stone in the 16th century, this round fortress with five towers stands on the Dniester River.",
        hy: "16-\u2060րդ դարում քարից վերակառուցված այս կլոր ամրոցը՝ հինգ աշտարակով, կանգնած է Դնեստր գետի ափին։",
      },
      // In Soroca, on the Dniester, not the capital.
      coordinates: [28.3055, 48.1612],
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
