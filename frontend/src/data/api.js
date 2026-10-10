// Single entry point for all data access. Pages import `api` from here and never talk to
// Firestore or localStorage directly, so the backend can swap implementations freely.
import { DATA_SOURCE } from '../config.js'
import { mockApi } from './mockApi.js'
import { firebaseApi } from './firebaseApi.js'

export const api = DATA_SOURCE === 'firebase' ? firebaseApi : mockApi
export const isMock = api === mockApi
export { ApiError } from './errors.js'
