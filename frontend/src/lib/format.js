import { FX_TO_USDC } from '../config.js'

const SYMBOLS = { GBP: '£', EUR: '€', USD: '$' }

export function fmtMoney(amount, currency = 'GBP') {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  const n = Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (currency === 'USDC') return `${n} USDC`
  return `${SYMBOLS[currency] ?? currency + ' '}${n}`
}

export const round2 = (n) => Math.round(Number(n) * 100) / 100

export const toUsdc = (amount, currency) => round2(amount * (FX_TO_USDC[currency] ?? 1))

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function relTime(iso) {
  if (!iso) return '—'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function shortAddr(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export const isEvmAddress = (s) => /^0x[a-fA-F0-9]{40}$/.test(s ?? '')

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
