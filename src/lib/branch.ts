export const MALAYSIA_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Labuan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Putrajaya",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
] as const

export type MalaysiaState = (typeof MALAYSIA_STATES)[number]

// Normalised lowercase input → canonical state name
const LOOKUP: Record<string, string> = {
  // Kuala Lumpur
  "kl": "Kuala Lumpur",
  "kuala lumpur": "Kuala Lumpur",
  "klcc": "Kuala Lumpur",
  "bukit bintang": "Kuala Lumpur",
  "chow kit": "Kuala Lumpur",
  "bangsar": "Kuala Lumpur",
  "mont kiara": "Kuala Lumpur",
  "mont'kiara": "Kuala Lumpur",
  "kepong": "Kuala Lumpur",
  "segambut": "Kuala Lumpur",
  "setiawangsa": "Kuala Lumpur",
  "wangsa maju": "Kuala Lumpur",
  "titiwangsa": "Kuala Lumpur",
  "setapak": "Kuala Lumpur",
  "sentul": "Kuala Lumpur",
  "brickfields": "Kuala Lumpur",
  "sri petaling": "Kuala Lumpur",
  "cheras kl": "Kuala Lumpur",
  "federal territory": "Kuala Lumpur",
  "wilayah persekutuan": "Kuala Lumpur",
  "wp kl": "Kuala Lumpur",
  "wp kuala lumpur": "Kuala Lumpur",

  // Selangor
  "selangor": "Selangor",
  "petaling jaya": "Selangor",
  "pj": "Selangor",
  "shah alam": "Selangor",
  "subang jaya": "Selangor",
  "subang": "Selangor",
  "klang": "Selangor",
  "puchong": "Selangor",
  "kajang": "Selangor",
  "cyberjaya": "Selangor",
  "sepang": "Selangor",
  "rawang": "Selangor",
  "serdang": "Selangor",
  "bangi": "Selangor",
  "bandar baru bangi": "Selangor",
  "bbb": "Selangor",
  "balakong": "Selangor",
  "semenyih": "Selangor",
  "sungai buloh": "Selangor",
  "sg buloh": "Selangor",
  "sg. buloh": "Selangor",
  "damansara": "Selangor",
  "ara damansara": "Selangor",
  "kota damansara": "Selangor",
  "batu caves": "Selangor",
  "gombak": "Selangor",
  "ampang": "Selangor",
  "cheras": "Selangor",
  "hulu langat": "Selangor",
  "sunway": "Selangor",
  "usj": "Selangor",
  "port klang": "Selangor",
  "banting": "Selangor",
  "jenjarom": "Selangor",
  "kuala selangor": "Selangor",
  "klang valley": "Selangor",
  "pandan": "Selangor",
  "alam damai": "Selangor",

  // Penang
  "penang": "Penang",
  "pulau pinang": "Penang",
  "george town": "Penang",
  "georgetown": "Penang",
  "butterworth": "Penang",
  "bayan lepas": "Penang",
  "seberang perai": "Penang",
  "bukit mertajam": "Penang",
  "nibong tebal": "Penang",
  "air itam": "Penang",
  "pg": "Penang",

  // Johor
  "johor": "Johor",
  "johor bahru": "Johor",
  "johor baru": "Johor",
  "jb": "Johor",
  "skudai": "Johor",
  "muar": "Johor",
  "batu pahat": "Johor",
  "kluang": "Johor",
  "segamat": "Johor",
  "mersing": "Johor",
  "pontian": "Johor",
  "kulai": "Johor",
  "iskandar puteri": "Johor",
  "pasir gudang": "Johor",
  "senai": "Johor",
  "tebrau": "Johor",
  "masai": "Johor",

  // Perak
  "perak": "Perak",
  "ipoh": "Perak",
  "taiping": "Perak",
  "teluk intan": "Perak",
  "sitiawan": "Perak",
  "lumut": "Perak",
  "batu gajah": "Perak",
  "seri manjung": "Perak",
  "kampar": "Perak",

  // Negeri Sembilan
  "negeri sembilan": "Negeri Sembilan",
  "ns": "Negeri Sembilan",
  "n9": "Negeri Sembilan",
  "seremban": "Negeri Sembilan",
  "port dickson": "Negeri Sembilan",
  "pd": "Negeri Sembilan",
  "nilai": "Negeri Sembilan",
  "senawang": "Negeri Sembilan",
  "mantin": "Negeri Sembilan",
  "rembau": "Negeri Sembilan",

  // Melaka
  "melaka": "Melaka",
  "malacca": "Melaka",
  "ayer keroh": "Melaka",
  "alor gajah": "Melaka",
  "jasin": "Melaka",
  "masjid tanah": "Melaka",
  "bukit katil": "Melaka",

  // Pahang
  "pahang": "Pahang",
  "kuantan": "Pahang",
  "temerloh": "Pahang",
  "bentong": "Pahang",
  "cameron highlands": "Pahang",
  "raub": "Pahang",
  "mentakab": "Pahang",
  "jerantut": "Pahang",

  // Kelantan
  "kelantan": "Kelantan",
  "kota bharu": "Kelantan",
  "kb": "Kelantan",
  "pasir mas": "Kelantan",
  "tanah merah": "Kelantan",
  "machang": "Kelantan",
  "bachok": "Kelantan",

  // Terengganu
  "terengganu": "Terengganu",
  "kuala terengganu": "Terengganu",
  "kt": "Terengganu",
  "kemaman": "Terengganu",
  "kerteh": "Terengganu",
  "dungun": "Terengganu",
  "besut": "Terengganu",
  "cukai": "Terengganu",

  // Kedah
  "kedah": "Kedah",
  "alor setar": "Kedah",
  "alor star": "Kedah",
  "sungai petani": "Kedah",
  "sp": "Kedah",
  "kulim": "Kedah",
  "langkawi": "Kedah",
  "baling": "Kedah",

  // Perlis
  "perlis": "Perlis",
  "kangar": "Perlis",
  "arau": "Perlis",

  // Sabah
  "sabah": "Sabah",
  "kota kinabalu": "Sabah",
  "kk": "Sabah",
  "sandakan": "Sabah",
  "tawau": "Sabah",
  "lahad datu": "Sabah",
  "keningau": "Sabah",
  "semporna": "Sabah",
  "kudat": "Sabah",

  // Sarawak
  "sarawak": "Sarawak",
  "kuching": "Sarawak",
  "miri": "Sarawak",
  "sibu": "Sarawak",
  "bintulu": "Sarawak",
  "limbang": "Sarawak",

  // Putrajaya
  "putrajaya": "Putrajaya",
  "wp putrajaya": "Putrajaya",

  // Labuan
  "labuan": "Labuan",
  "wp labuan": "Labuan",
}

export function resolveStateBranch(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ")
  return LOOKUP[key] ?? null
}
