// Number-word lexicon (Hindi, Gujarati, English; Latin, Devanagari and Gujarati script).
// Pure data plus a lookup. Words are compared after `foldWord` so common spelling variants
// (hazaar/hajar/hazar, पाँच/पांच, हज़ार/हजार) share one entry.

/** Folds spelling variants: lowercase, Devanagari nukta/chandrabindu, Latin vowel/consonant doubling. */
export function foldWord(word: string): string {
  return word
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‌‍़]/g, "") // joiners, Devanagari nukta
    .replace(/ँ/g, "ं") // chandrabindu -> anusvara
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/(\p{Script=Latin})\1+/gu, "$1")
    .replace(/w/g, "v")
    .replace(/z/g, "j");
}

export type WordEntry =
  | { kind: "num"; value: number; tens?: boolean; ambiguous?: boolean }
  | { kind: "mult"; value: number }
  | { kind: "frac"; frac: number };

const table = new Map<string, WordEntry>();

function add(words: string, entry: WordEntry): void {
  for (const w of words.split(/\s+/)) if (w) table.set(foldWord(w), entry);
}
function nums(list: Array<[number, string]>, ambiguousWords: string[] = []): void {
  const ambiguous = new Set(ambiguousWords.map(foldWord));
  for (const [value, words] of list) {
    for (const w of words.split(/\s+/)) {
      if (!w) continue;
      const key = foldWord(w);
      table.set(key, {
        kind: "num",
        value,
        tens: value >= 20 && value % 10 === 0 && value < 100,
        ...(ambiguous.has(key) ? { ambiguous: true } : {}),
      });
    }
  }
}

// ---- Hindi, Latin (0-99). "saath"/"sath" (60) and "do" (2) double as ordinary words: ambiguous.
nums(
  [
    [0, "shunya zero"], [1, "ek"], [2, "do"], [3, "teen tin"], [4, "char"], [5, "panch pach"],
    [6, "chhah chah chhai"], [7, "saat"], [8, "aath"], [9, "nau"], [10, "das"],
    [11, "gyarah giyarah"], [12, "barah"], [13, "terah"], [14, "chaudah"], [15, "pandrah pandra"],
    [16, "solah"], [17, "satrah"], [18, "atharah"], [19, "unnis unis"], [20, "bees bis"],
    [21, "ikkis"], [22, "baais bais"], [23, "teis"], [24, "chaubis"], [25, "pachchis pachis"],
    [26, "chhabbis chhabis"], [27, "sattais"], [28, "atthais"], [29, "unatis unattis"], [30, "tees tis"],
    [31, "ikatis ikattis"], [32, "battis"], [33, "taintis tentis"], [34, "chauntis"], [35, "paintis"],
    [36, "chhattis chhatis"], [37, "saintis"], [38, "adtis artis"], [39, "unchalis untalis"], [40, "chalis"],
    [41, "iktalis"], [42, "bayalis byalis"], [43, "tentalis taintalis"], [44, "chauvalis chavalis"],
    [45, "paintalis"], [46, "chhiyalis chhyalis"], [47, "saintalis"], [48, "adtalis artalis"],
    [49, "unchas unanchas"], [50, "pachas pachash"], [51, "ikyavan"], [52, "bavan"], [53, "trepan tirpan"],
    [54, "chauvan"], [55, "pachpan"], [56, "chhappan chhapan"], [57, "sattavan"], [58, "atthavan"],
    [59, "unsath unasath"], [60, "saath sath"], [61, "iksath"], [62, "basath"], [63, "tirsath"],
    [64, "chausath"], [65, "painsath"], [66, "chhiyasath"], [67, "sadsath sarsath"], [68, "adsath"],
    [69, "unhattar unahattar"], [70, "sattar"], [71, "ikhattar"], [72, "bahattar"], [73, "tihattar"],
    [74, "chauhattar"], [75, "pachattar pachhattar"], [76, "chhihattar"], [77, "satattar sathattar"],
    [78, "athattar"], [79, "unyasi unnasi"], [80, "assi asi"], [81, "ikyasi"], [82, "bayasi"],
    [83, "tirasi"], [84, "chaurasi"], [85, "pachasi"], [86, "chhiyasi"], [87, "sattasi"], [88, "atthasi"],
    [89, "navasi"], [90, "nabbe"], [91, "ikyanve"], [92, "banve"], [93, "tiranve"], [94, "chauranve"],
    [95, "pachanve"], [96, "chhiyanve"], [97, "sattanve"], [98, "atthanve"], [99, "ninyanve ninanve"],
  ],
  ["do", "saath", "sath", "saat"],
);

// ---- Hindi, Devanagari (0-99)
nums([
  [0, "शून्य ज़ीरो"], [1, "एक"], [2, "दो"], [3, "तीन"], [4, "चार"], [5, "पांच पाँच"], [6, "छह छः"],
  [7, "सात"], [8, "आठ"], [9, "नौ"], [10, "दस"], [11, "ग्यारह"], [12, "बारह"], [13, "तेरह"], [14, "चौदह"],
  [15, "पंद्रह पन्द्रह"], [16, "सोलह"], [17, "सत्रह"], [18, "अठारह"], [19, "उन्नीस"], [20, "बीस"],
  [21, "इक्कीस"], [22, "बाईस"], [23, "तेईस"], [24, "चौबीस"], [25, "पच्चीस"], [26, "छब्बीस"],
  [27, "सत्ताईस"], [28, "अट्ठाईस अठाईस"], [29, "उनतीस"], [30, "तीस"], [31, "इकतीस"], [32, "बत्तीस"],
  [33, "तैंतीस"], [34, "चौंतीस"], [35, "पैंतीस"], [36, "छत्तीस"], [37, "सैंतीस"], [38, "अड़तीस"],
  [39, "उनतालीस"], [40, "चालीस"], [41, "इकतालीस"], [42, "बयालीस"], [43, "तैंतालीस"],
  [44, "चवालीस चौवालीस"], [45, "पैंतालीस"], [46, "छियालीस"], [47, "सैंतालीस"], [48, "अड़तालीस"],
  [49, "उनचास"], [50, "पचास"], [51, "इक्यावन"], [52, "बावन"], [53, "तिरपन तिरेपन"], [54, "चौवन"],
  [55, "पचपन"], [56, "छप्पन"], [57, "सत्तावन"], [58, "अट्ठावन अठावन"], [59, "उनसठ"], [60, "साठ"],
  [61, "इकसठ"], [62, "बासठ"], [63, "तिरसठ"], [64, "चौंसठ"], [65, "पैंसठ"], [66, "छियासठ"], [67, "सड़सठ"],
  [68, "अड़सठ"], [69, "उनहत्तर"], [70, "सत्तर"], [71, "इकहत्तर"], [72, "बहत्तर"], [73, "तिहत्तर"],
  [74, "चौहत्तर"], [75, "पचहत्तर"], [76, "छिहत्तर"], [77, "सतहत्तर"], [78, "अठहत्तर"], [79, "उनासी"],
  [80, "अस्सी"], [81, "इक्यासी"], [82, "बयासी"], [83, "तिरासी"], [84, "चौरासी"], [85, "पचासी"],
  [86, "छियासी"], [87, "सत्तासी"], [88, "अट्ठासी"], [89, "नवासी"], [90, "नब्बे"], [91, "इक्यानवे"],
  [92, "बानवे"], [93, "तिरानवे"], [94, "चौरानवे"], [95, "पंचानवे"], [96, "छियानवे"], [97, "सत्तानवे"],
  [98, "अट्ठानवे"], [99, "निन्यानवे"],
]);

// ---- Gujarati, Latin. "be" (2) and "bar" (12) double as English words: ambiguous.
nums(
  [
    [1, "ek"], [2, "be"], [3, "tran"], [4, "chaar"], [5, "paanch"], [6, "chha"], [7, "saat"], [8, "aath"],
    [9, "nav"], [10, "das"], [11, "agiyar"], [12, "baar"], [13, "ter"], [14, "chaud"], [15, "pandar"],
    [16, "sol"], [17, "satar"], [18, "adhar"], [19, "ogani"], [20, "vees"], [30, "trees"],
    [40, "chalis"], [50, "pachas"], [60, "saath"], [70, "sitter"], [80, "ensi"], [90, "nevu"],
  ],
  ["be", "baar", "saath"],
);

// ---- Gujarati, script (0-20, tens)
nums([
  [1, "એક"], [2, "બે"], [3, "ત્રણ"], [4, "ચાર"], [5, "પાંચ"], [6, "છ"], [7, "સાત"], [8, "આઠ"], [9, "નવ"],
  [10, "દસ"], [11, "અગિયાર"], [12, "બાર"], [13, "તેર"], [14, "ચૌદ"], [15, "પંદર"], [16, "સોળ"],
  [17, "સત્તર"], [18, "અઢાર"], [19, "ઓગણીસ"], [20, "વીસ"], [25, "પચીસ"], [30, "ત્રીસ"], [40, "ચાલીસ"],
  [50, "પચાસ"], [60, "સાઠ"], [70, "સિત્તેર"], [80, "એંસી"], [90, "નેવું"],
]);

// ---- English one-ninety-nine
nums(
  [
    [0, "zero"], [1, "one"], [2, "two"], [3, "three"], [4, "four"], [5, "five"], [6, "six"], [7, "seven"],
    [8, "eight"], [9, "nine"], [10, "ten"], [11, "eleven"], [12, "twelve"], [13, "thirteen"],
    [14, "fourteen"], [15, "fifteen"], [16, "sixteen"], [17, "seventeen"], [18, "eighteen"],
    [19, "nineteen"], [20, "twenty"], [30, "thirty"], [40, "forty"], [50, "fifty"], [60, "sixty"],
    [70, "seventy"], [80, "eighty"], [90, "ninety"],
  ],
  ["one"],
);

// ---- Multipliers
add("hundred hundreds sau सौ સો", { kind: "mult", value: 100 });
add("thousand thousands hazaar hajar hazar हज़ार हजार હજાર", { kind: "mult", value: 1_000 });
add("lakh lakhs lac lacs लाख લાખ", { kind: "mult", value: 100_000 });
add("crore crores karod karor करोड़ करोड કરોડ", { kind: "mult", value: 10_000_000 });

// ---- Fractions. sava/saade/paune add or subtract a quarter/half before a number or multiplier.
add("sava सवा સવા", { kind: "frac", frac: 0.25 });
add("saade saadhe sadhe sade साढ़े साढे સાડા", { kind: "frac", frac: 0.5 });
add("paune pone pona पौने પોણા", { kind: "frac", frac: -0.25 });
// dedh/dhai/adhai are whole coefficients (1.5, 2.5).
add("dedh ded डेढ़ डेढ દોઢ", { kind: "num", value: 1.5 });
add("dhai adhai ढाई અઢી adhi", { kind: "num", value: 2.5 });

export function lookupNumberWord(word: string): WordEntry | undefined {
  return table.get(foldWord(word));
}

/** Words that, right after a lone ambiguous number word ("do", "be"), show it is a quantity. */
const QUANTITY_FOLLOWERS = new Set(
  [
    "kilowatt", "kilowatts", "kilo", "kw", "kv", "unit", "units", "yunit", "kwh", "rupees", "rupee", "rupaye",
    "rupiya", "rs", "bill", "किलोवाट", "यूनिट", "यूनिट्स", "रुपये", "रुपए", "बिल", "કિલોવોટ", "યુનિટ",
    "રૂપિયા", "બિલ",
  ].map(foldWord),
);

export function isQuantityWord(word: string): boolean {
  return QUANTITY_FOLLOWERS.has(foldWord(word));
}
