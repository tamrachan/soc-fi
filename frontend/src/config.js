export const APP_NAME = 'SocFi'
export const TAGLINE = 'Society Finance, secured.'
export const UNIVERSITY = 'University of St Andrews'
export const UNION_NAME = "St Andrews Students' Association"
export const UNION_SHORT = 'Your Union'
// Shown as text, not a mailto: this is a pilot, so we don't name a real inbox.
export const UNION_CONTACT = "the Societies team at the Students' Association"
export const UNI_EMAIL_SUFFIX = '@st-andrews.ac.uk'
export const EMAIL_PLACEHOLDER = 'ab123@st-andrews.ac.uk'

// "mock" serves the GitHub Pages demo from localStorage; "firebase" uses src/data/firebaseApi.js;
// "hybrid" is mock data with payments signed on the Ledger through backend/ (src/data/hybridApi.js).
export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'mock'
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

// Mock FX quote: 1 unit of claim currency -> USDC. The backend should quote and store
// the rate on the payment record at approval time (see HANDOVER.md).
export const FX_TO_USDC = { GBP: 1.27, EUR: 1.08, USD: 1 }

// The Union's wallet: the only one that pays. This is the emulated Ledger's first address.
export const UNION_TREASURY_WALLET = '0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D'

export const NETWORKS = {
  'base-sepolia': { label: 'Base Sepolia', explorer: 'https://sepolia.basescan.org/tx/' },
}

export const RECENT_RECEIPT_DAYS = 90
