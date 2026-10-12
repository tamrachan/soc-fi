// Single entry point for all data access. Pages import `api` from here and never talk to
// Firestore or localStorage directly, so the backend can swap implementations freely.
import { DATA_SOURCE } from '../config.js'
import { mockApi } from './mockApi.js'
import { firebaseApi } from './firebaseApi.js'
import { hybridApi } from './hybridApi.js'

export const api = DATA_SOURCE === 'firebase' ? firebaseApi : DATA_SOURCE === 'hybrid' ? hybridApi : mockApi
export const isMock = api !== firebaseApi
// True when payments are signed on a Ledger (emulated) rather than simulated in the page.
export const hasDevice = api === hybridApi
export { ApiError } from './errors.js'
