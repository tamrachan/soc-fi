// Mock data, real agent and real signing. Everything stays in mockApi except two steps that go to
// backend/ (Express + Ledger DMK): the agent's verdict on a claim, and the Ledger signature.
// For the signature the backend drafts the USDC transfer, waits for the treasurer
// to confirm on the device, broadcasts it and returns the transaction hash.
import { AGENT_NAME, BACKEND_URL } from '../config.js'
import { ApiError } from './errors.js'
import { mockApi } from './mockApi.js'

const DEVICE = 'Ledger Nano S Plus (emulated)'

async function post(path, body) {
  let res
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
  } catch {
    throw new ApiError('unavailable', `Signing backend not reachable at ${BACKEND_URL}.`)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status === 403 ? 'device-rejected' : 'unavailable', data.error ?? `Backend error ${res.status}.`)
  return data
}

export const hybridApi = {
  ...mockApi,

  // The backend agent judges the claim with the society's profile and policy as context. Its
  // verdict is added to the rule checks; if it cannot be reached the claim is not submitted.
  async submitClaim(payload) {
    const { fields, receipt } = payload
    // The member may switch persona or sign out while the agent thinks; the claim stays theirs.
    const asUserId = payload.asUserId ?? (await mockApi.getSession()).user?.id
    if (!asUserId) throw new ApiError('auth/required', 'Please sign in.')
    const { name, category, reimbursement: r } = await mockApi.getSociety(payload.societyId)
    const extraction = payload.aiExtraction ?? (await mockApi.extractReceipt(receipt))
    const image = receipt?.kind === 'upload' && receipt.dataUrl?.startsWith('data:image') ? receipt.dataUrl : undefined
    // Attack demo: the agent is not asked. It is taken to have followed the receipt's hidden text.
    const tricked = mockApi.demo.attack() && extraction?.obeyedInstruction
    const agentVerdict = tricked
      ? { decision: 'approve', reason: `Attack demo: ${AGENT_NAME} followed the instructions hidden on the receipt.`, flags: [] }
      : await post('/api/agent/audit', {
          society: {
            name,
            category,
            allowedCategories: r.allowedCategories,
            perClaimLimit: r.perClaimLimit,
            termBudget: r.termBudget,
            spentThisTerm: r.spentThisTerm,
            currency: r.currency,
          },
          claim: { ...fields, amount: Number(fields.amount) },
          receiptText:
            extraction?.rawTextExcerpt ||
            JSON.stringify({ merchant: extraction?.merchant, date: extraction?.date, total: extraction?.total, items: extraction?.items }),
          receiptImage: image,
        })
    return mockApi.submitClaim({ ...payload, aiExtraction: extraction, agentVerdict, asUserId })
  },

  // Resolves once the treasurer has confirmed on the device and the transfer is on-chain.
  // Throws ApiError('device-rejected') if they reject it there.
  async confirmOnDevice(paymentId) {
    const p = (await mockApi.listPayments()).find((x) => x.id === paymentId)
    if (!p) throw new ApiError('not-found', 'Payment not found.')
    if (p.status !== 'awaiting_device') throw new ApiError('failed-precondition', 'This payment is not waiting for the device.')
    const { txHash } = await post('/api/payments/sign', {
      paymentId,
      recipientAddress: p.recipientAddress,
      amountUsdc: p.amount,
      claimReference: p.claimReference,
    })
    return mockApi.confirmOnDevice(paymentId, { txHash, device: DEVICE })
  },

  device: {
    label: DEVICE,
    screenshotUrl: () => `${BACKEND_URL}/api/device/screenshot?t=${Date.now()}`,
    press: (button) => post(`/api/device/button/${button}`),
  },
}
