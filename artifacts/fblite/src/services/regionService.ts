import { getLanguageByCode, getPopularLanguages, type Language } from "./languageService";

export interface RegionInfo {
  countryCode: string;
  countryName: string;
  countryFlag: string;
  langCode: string;
  currency: string;
  timezone: string;
  detected: boolean;
}

const COUNTRY_LANG: Record<string, string> = {
  FR: "fr", BE: "fr", CH: "fr", LU: "fr",
  BJ: "fr", SN: "fr", CI: "fr", ML: "fr", BF: "fr", NE: "fr", TG: "fr",
  GN: "fr", CM: "fr", GA: "fr", CG: "fr", CD: "fr", MG: "fr",
  DZ: "fr", MA: "fr", TN: "fr", MU: "fr", DJ: "fr", KM: "fr", SC: "fr",
  GB: "en", US: "en", AU: "en", NZ: "en", IE: "en",
  NG: "en", GH: "en", ZA: "en", KE: "en", UG: "en", TZ: "en", ET: "am",
  RW: "rw", ZM: "en", ZW: "sn", MW: "ny", LS: "st", BW: "en",
  IN: "hi", PK: "ur", BD: "bn", LK: "si", MM: "my", NP: "ne",
  ES: "es", MX: "es", CO: "es", AR: "es", PE: "es", VE: "es",
  CL: "es", EC: "es", BO: "es", PY: "es", UY: "es", GT: "es",
  CU: "es", DO: "es", HN: "es", SV: "es", NI: "es", CR: "es", PA: "es",
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt", CV: "pt", GW: "pt", ST: "pt",
  SA: "ar", EG: "ar", AE: "ar", IQ: "ar", SY: "ar", JO: "ar",
  LB: "ar", KW: "ar", QA: "ar", BH: "ar", OM: "ar", YE: "ar",
  LY: "ar", SD: "ar", MR: "ar",
  CN: "zh", TW: "zh", HK: "zh", MO: "zh", SG: "zh",
  RU: "ru", BY: "ru", KZ: "ru", KG: "ky",
  DE: "de", AT: "de",
  TR: "tr",
  JP: "ja",
  KR: "ko",
  IT: "it",
  NL: "nl",
  PL: "pl",
  UA: "uk",
  SE: "sv",
  NO: "no",
  DK: "da",
  FI: "fi",
  CZ: "cs",
  HU: "hu",
  RO: "ro",
  GR: "el",
  IL: "he",
  IR: "fa",
  TH: "th",
  ID: "id",
  MY: "ms",
  VN: "vi",
  PH: "tl",
  SO: "so",
  UZ: "uz",
  AZ: "az",
  GE: "ka",
  AM: "hy",
  KH: "km",
  LA: "lo",
  MN: "mn",
  HT: "ht",
};

const COUNTRY_CURRENCY: Record<string, string> = {
  FR: "EUR", BE: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", NL: "EUR",
  US: "USD", GB: "GBP", JP: "JPY", CN: "CNY", KR: "KRW",
  BJ: "XOF", SN: "XOF", CI: "XOF", ML: "XOF", BF: "XOF", NE: "XOF", TG: "XOF",
  GN: "GNF", CM: "XAF", GA: "XAF", CG: "XAF", CD: "CDF",
  BR: "BRL", MX: "MXN", AR: "ARS", CO: "COP",
  IN: "INR", NG: "NGN", ZA: "ZAR", KE: "KES",
  CA: "CAD", AU: "AUD", CH: "CHF", SA: "SAR", AE: "AED",
  TR: "TRY", RU: "RUB", MA: "MAD", DZ: "DZD", TN: "TND", EG: "EGP",
};

const TIMEZONE_COUNTRY: Record<string, string> = {
  "Africa/Porto-Novo": "BJ", "Africa/Cotonou": "BJ",
  "Africa/Dakar": "SN", "Africa/Abidjan": "CI", "Africa/Bamako": "ML",
  "Africa/Ouagadougou": "BF", "Africa/Niamey": "NE", "Africa/Lome": "TG",
  "Africa/Conakry": "GN", "Africa/Douala": "CM", "Africa/Libreville": "GA",
  "Africa/Brazzaville": "CG", "Africa/Kinshasa": "CD", "Africa/Lagos": "NG",
  "Africa/Accra": "GH", "Africa/Nairobi": "KE", "Africa/Addis_Ababa": "ET",
  "Africa/Johannesburg": "ZA", "Africa/Casablanca": "MA", "Africa/Tunis": "TN",
  "Africa/Algiers": "DZ", "Africa/Cairo": "EG",
  "Europe/Paris": "FR", "Europe/Brussels": "BE", "Europe/Berlin": "DE",
  "Europe/London": "GB", "Europe/Madrid": "ES", "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL", "Europe/Warsaw": "PL", "Europe/Lisbon": "PT",
  "America/New_York": "US", "America/Chicago": "US", "America/Los_Angeles": "US",
  "America/Toronto": "CA", "America/Sao_Paulo": "BR", "America/Mexico_City": "MX",
  "America/Buenos_Aires": "AR", "America/Bogota": "CO",
  "Asia/Tokyo": "JP", "Asia/Shanghai": "CN", "Asia/Seoul": "KR",
  "Asia/Kolkata": "IN", "Asia/Dubai": "AE", "Asia/Riyadh": "SA",
  "Asia/Istanbul": "TR", "Asia/Tehran": "IR", "Asia/Bangkok": "TH",
  "Asia/Jakarta": "ID", "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY",
  "Pacific/Auckland": "NZ", "Australia/Sydney": "AU",
};

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Bénin", SN: "Sénégal", CI: "Côte d'Ivoire", ML: "Mali",
  BF: "Burkina Faso", NE: "Niger", TG: "Togo", GN: "Guinée",
  CM: "Cameroun", GA: "Gabon", CG: "Congo", CD: "RD Congo",
  MG: "Madagascar", DZ: "Algérie", MA: "Maroc", TN: "Tunisie", EG: "Égypte",
  FR: "France", BE: "Belgique", CH: "Suisse", LU: "Luxembourg",
  GB: "Royaume-Uni", US: "États-Unis", CA: "Canada", AU: "Australie",
  NZ: "Nouvelle-Zélande", IE: "Irlande",
  ES: "Espagne", MX: "Mexique", CO: "Colombie", AR: "Argentine",
  BR: "Brésil", PT: "Portugal",
  SA: "Arabie Saoudite", AE: "Émirats Arabes Unis",
  CN: "Chine", JP: "Japon", KR: "Corée du Sud", IN: "Inde",
  DE: "Allemagne", IT: "Italie", NL: "Pays-Bas", PL: "Pologne",
  RU: "Russie", TR: "Turquie", UA: "Ukraine", SE: "Suède",
  NO: "Norvège", DK: "Danemark", FI: "Finlande", NG: "Nigeria",
  GH: "Ghana", ZA: "Afrique du Sud", KE: "Kenya",
  ID: "Indonésie", MY: "Malaisie", TH: "Thaïlande", VN: "Vietnam",
  PH: "Philippines", SG: "Singapour", PK: "Pakistan",
};

const COUNTRY_FLAGS: Record<string, string> = {
  BJ: "🇧🇯", SN: "🇸🇳", CI: "🇨🇮", ML: "🇲🇱", BF: "🇧🇫", NE: "🇳🇪",
  TG: "🇹🇬", GN: "🇬🇳", CM: "🇨🇲", GA: "🇬🇦", CG: "🇨🇬", CD: "🇨🇩",
  MG: "🇲🇬", DZ: "🇩🇿", MA: "🇲🇦", TN: "🇹🇳", EG: "🇪🇬",
  FR: "🇫🇷", BE: "🇧🇪", CH: "🇨🇭", LU: "🇱🇺",
  GB: "🇬🇧", US: "🇺🇸", CA: "🇨🇦", AU: "🇦🇺", NZ: "🇳🇿", IE: "🇮🇪",
  ES: "🇪🇸", MX: "🇲🇽", CO: "🇨🇴", AR: "🇦🇷", PE: "🇵🇪",
  BR: "🇧🇷", PT: "🇵🇹", AO: "🇦🇴", MZ: "🇲🇿",
  SA: "🇸🇦", AE: "🇦🇪", IQ: "🇮🇶", JO: "🇯🇴", KW: "🇰🇼",
  QA: "🇶🇦", LB: "🇱🇧", YE: "🇾🇪",
  CN: "🇨🇳", TW: "🇹🇼", HK: "🇭🇰", SG: "🇸🇬",
  JP: "🇯🇵", KR: "🇰🇷", IN: "🇮🇳", PK: "🇵🇰", BD: "🇧🇩",
  DE: "🇩🇪", AT: "🇦🇹", IT: "🇮🇹", NL: "🇳🇱", PL: "🇵🇱",
  RU: "🇷🇺", UA: "🇺🇦", TR: "🇹🇷", SE: "🇸🇪", NO: "🇳🇴",
  DK: "🇩🇰", FI: "🇫🇮", GR: "🇬🇷", RO: "🇷🇴", HU: "🇭🇺",
  IL: "🇮🇱", IR: "🇮🇷", TH: "🇹🇭", ID: "🇮🇩", MY: "🇲🇾",
  VN: "🇻🇳", PH: "🇵🇭", KE: "🇰🇪", NG: "🇳🇬", GH: "🇬🇭",
  ZA: "🇿🇦", ET: "🇪🇹",
};

function guessFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY[tz] ?? null;
  } catch { return null; }
}

function guessFromBrowserLang(): string {
  const lang = navigator.language || navigator.languages?.[0] || "fr";
  const base = lang.split("-")[0].toLowerCase();
  const country = lang.split("-")[1]?.toUpperCase();
  if (country && COUNTRY_LANG[country]) return COUNTRY_LANG[country];
  return base;
}

function buildRegion(countryCode: string, detected: boolean): RegionInfo {
  const langCode = COUNTRY_LANG[countryCode] ?? guessFromBrowserLang();
  return {
    countryCode,
    countryName: COUNTRY_NAMES[countryCode] ?? countryCode,
    countryFlag: COUNTRY_FLAGS[countryCode] ?? "🌍",
    langCode,
    currency: COUNTRY_CURRENCY[countryCode] ?? "USD",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    detected,
  };
}

const CACHE_KEY = "bp_region_v1";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export function getCachedRegion(): RegionInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as RegionInfo;
  } catch { return null; }
}

export function saveRegion(r: RegionInfo) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: r, ts: Date.now() }));
  } catch {}
}

export async function detectRegion(): Promise<RegionInfo> {
  const cached = getCachedRegion();
  if (cached) return cached;

  let result: RegionInfo | null = null;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch("https://ipapi.co/json/", { signal: ctrl.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const cc = (data.country_code as string)?.toUpperCase();
      if (cc && cc.length === 2) {
        result = buildRegion(cc, true);
        result.currency = data.currency ?? result.currency;
        result.timezone = data.timezone ?? result.timezone;
        if (data.country_name) result.countryName = data.country_name;
      }
    }
  } catch {}

  if (!result) {
    const tz = guessFromTimezone();
    if (tz) {
      result = buildRegion(tz, true);
    }
  }

  if (!result) {
    const langCode = guessFromBrowserLang();
    result = {
      countryCode: "",
      countryName: "",
      countryFlag: "🌍",
      langCode,
      currency: "USD",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      detected: false,
    };
  }

  saveRegion(result);
  return result;
}

export function getLanguageForRegion(region: RegionInfo): Language {
  const lang = getLanguageByCode(region.langCode);
  return lang ?? getPopularLanguages()[0];
}
