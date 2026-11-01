/**
 * Detect the country a WhatsApp number belongs to from its international
 * calling code (longest-prefix match). WhatsApp numbers always arrive in
 * E.164 form without the "+" (e.g. "573112021423" → Colombia), so the
 * leading digits are the country code.
 *
 * Shared calling codes:
 *  - +1 (NANP): resolved by area code — Canada and the Caribbean
 *    (Dominican Republic, Puerto Rico, Jamaica…) get their own entries;
 *    anything else falls back to the United States.
 *  - +7: Kazakhstan for 76/77, Russia otherwise.
 */

// Calling code → ISO 3166-1 alpha-2. Keys are digits only.
const CALLING_CODES: Record<string, string> = {
  // North America (NANP overrides below)
  "1": "US",
  // Latin America
  "52": "MX", "53": "CU", "54": "AR", "55": "BR", "56": "CL", "57": "CO", "58": "VE",
  "51": "PE", "591": "BO", "592": "GY", "593": "EC", "594": "GF", "595": "PY",
  "596": "MQ", "597": "SR", "598": "UY", "599": "CW",
  "501": "BZ", "502": "GT", "503": "SV", "504": "HN", "505": "NI", "506": "CR",
  "507": "PA", "509": "HT", "590": "GP", "297": "AW",
  // Europe
  "30": "GR", "31": "NL", "32": "BE", "33": "FR", "34": "ES", "36": "HU", "39": "IT",
  "40": "RO", "41": "CH", "43": "AT", "44": "GB", "45": "DK", "46": "SE", "47": "NO",
  "48": "PL", "49": "DE", "350": "GI", "351": "PT", "352": "LU", "353": "IE",
  "354": "IS", "355": "AL", "356": "MT", "357": "CY", "358": "FI", "359": "BG",
  "370": "LT", "371": "LV", "372": "EE", "373": "MD", "374": "AM", "375": "BY",
  "376": "AD", "377": "MC", "378": "SM", "380": "UA", "381": "RS", "382": "ME",
  "383": "XK", "385": "HR", "386": "SI", "387": "BA", "389": "MK", "420": "CZ",
  "421": "SK", "423": "LI", "7": "RU", "76": "KZ", "77": "KZ",
  // Africa
  "20": "EG", "27": "ZA", "211": "SS", "212": "MA", "213": "DZ", "216": "TN",
  "218": "LY", "220": "GM", "221": "SN", "222": "MR", "223": "ML", "224": "GN",
  "225": "CI", "226": "BF", "227": "NE", "228": "TG", "229": "BJ", "230": "MU",
  "231": "LR", "232": "SL", "233": "GH", "234": "NG", "235": "TD", "236": "CF",
  "237": "CM", "238": "CV", "239": "ST", "240": "GQ", "241": "GA", "242": "CG",
  "243": "CD", "244": "AO", "245": "GW", "248": "SC", "249": "SD", "250": "RW",
  "251": "ET", "252": "SO", "253": "DJ", "254": "KE", "255": "TZ", "256": "UG",
  "257": "BI", "258": "MZ", "260": "ZM", "261": "MG", "262": "RE", "263": "ZW",
  "264": "NA", "265": "MW", "266": "LS", "267": "BW", "268": "SZ", "269": "KM",
  "291": "ER",
  // Asia / Middle East
  "60": "MY", "61": "AU", "62": "ID", "63": "PH", "64": "NZ", "65": "SG", "66": "TH",
  "81": "JP", "82": "KR", "84": "VN", "86": "CN", "90": "TR", "91": "IN", "92": "PK",
  "93": "AF", "94": "LK", "95": "MM", "98": "IR", "850": "KP", "852": "HK",
  "853": "MO", "855": "KH", "856": "LA", "880": "BD", "886": "TW", "960": "MV",
  "961": "LB", "962": "JO", "963": "SY", "964": "IQ", "965": "KW", "966": "SA",
  "967": "YE", "968": "OM", "970": "PS", "971": "AE", "972": "IL", "973": "BH",
  "974": "QA", "975": "BT", "976": "MN", "977": "NP", "992": "TJ", "993": "TM",
  "994": "AZ", "995": "GE", "996": "KG", "998": "UZ",
  // Oceania
  "675": "PG", "679": "FJ", "685": "WS", "676": "TO", "687": "NC", "689": "PF",
};

// NANP area codes (after the leading 1) that are not the United States.
const NANP_AREA_CODES: Record<string, string> = {
  // Canada
  ...Object.fromEntries(
    [
      "204", "226", "236", "249", "250", "263", "289", "306", "343", "354", "365",
      "367", "368", "382", "403", "416", "418", "428", "431", "437", "438", "450",
      "468", "474", "506", "514", "519", "548", "579", "581", "584", "587", "604",
      "613", "639", "647", "672", "683", "705", "709", "742", "753", "778", "780",
      "782", "807", "819", "825", "867", "873", "879", "902", "905",
    ].map((a) => [a, "CA"])
  ),
  // Caribbean
  "809": "DO", "829": "DO", "849": "DO",
  "787": "PR", "939": "PR",
  "876": "JM", "658": "JM",
  "868": "TT", "246": "BB", "242": "BS", "441": "BM", "345": "KY",
  "284": "VG", "340": "VI", "264": "AI", "268": "AG", "767": "DM",
  "473": "GD", "664": "MS", "869": "KN", "758": "LC", "784": "VC",
  "721": "SX", "649": "TC", "671": "GU", "670": "MP", "684": "AS",
};

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2, uppercase (e.g. "CO"). */
  iso: string;
  /** Calling code without "+" (e.g. "57"). */
  dialCode: string;
  /** Localized country name (Spanish by default, e.g. "Colombia"). */
  name: string;
}

let displayNames: Intl.DisplayNames | null | undefined;
function countryName(iso: string, locale: string): string {
  try {
    if (displayNames === undefined || (displayNames && displayNames.resolvedOptions().locale !== locale)) {
      displayNames = new Intl.DisplayNames([locale], { type: "region" });
    }
    return displayNames?.of(iso) ?? iso;
  } catch {
    displayNames = null;
    return iso;
  }
}

export function getPhoneCountry(phone: string | null | undefined, locale = "es"): PhoneCountry | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Too short to be an international number — don't guess.
  if (digits.length < 8) return null;

  if (digits.startsWith("1")) {
    const iso = NANP_AREA_CODES[digits.slice(1, 4)] ?? "US";
    return { iso, dialCode: "1", name: countryName(iso, locale) };
  }

  for (let len = 3; len >= 1; len--) {
    const code = digits.slice(0, len);
    const iso = CALLING_CODES[code];
    if (iso) return { iso, dialCode: code === "76" || code === "77" ? "7" : code, name: countryName(iso, locale) };
  }
  return null;
}
