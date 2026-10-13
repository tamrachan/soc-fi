// Claims being checked right now. Submitting takes a few seconds (the agent reads the claim), and
// the member is free to leave the form meanwhile: the check carries on here, outside any page, and
// My claims shows it until the claim appears. In memory only, so a page reload drops what is in flight.
import { api } from './api.js'

let entries = []
const listeners = new Set()
const set = (next) => {
  entries = next
  listeners.forEach((fn) => fn())
}
const patch = (id, changes) => set(entries.map((e) => (e.id === id ? { ...e, ...changes } : e)))

export const subscribeSubmissions = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const getSubmissions = () => entries

/** Starts the submit and resolves to { ok, data, error }, like useAction's run. Never throws. */
export function startSubmission(payload, { userId, societyName }) {
  const id = `sub_${Math.random().toString(36).slice(2, 8)}`
  set([...entries, { id, userId, societyName, payload, status: 'checking', error: null }])
  return run(id, payload)
}

export function retrySubmission(id) {
  const e = entries.find((x) => x.id === id)
  if (!e || e.status !== 'failed') return
  patch(id, { status: 'checking', error: null })
  return run(id, { ...e.payload, asUserId: e.userId })
}

export const dismissSubmission = (id) => set(entries.filter((e) => e.id !== id))

async function run(id, payload) {
  try {
    const data = await api.submitClaim(payload)
    dismissSubmission(id)
    return { ok: true, data, id }
  } catch (error) {
    patch(id, { status: 'failed', error })
    return { ok: false, data: undefined, error, id }
  }
}
