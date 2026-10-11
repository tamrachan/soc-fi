// Deterministic scan of everything the reader saw on the receipt. This runs whatever the AI
// says, so a model that was itself fooled by the text still gets caught here.

const PATTERNS = [
  [/ignore\s+(?:all\s+|any\s+|your\s+|the\s+|previous\s+|prior\s+|above\s+)*(?:instructions|rules|validation|checks)/i, 'tells the reader to ignore its rules'],
  [/\b(?:note|message|instructions?)\s+(?:to|for)\s+(?:the\s+)?(?:ai|a\.i\.|assistant|model|agent|llm|gpt|claude|bot)\b/i, 'is addressed to an AI system'],
  [/\b(?:you are|act as|pretend to be)\s+(?:an?\s+)?(?:ai|assistant|model|agent)\b/i, 'tries to give the AI a role'],
  [/\b(?:system|developer)\s+prompt\b/i, 'mentions a system prompt'],
  [/\bpre-?\s?approved\b/i, 'claims to be pre-approved'],
  [/\b(?:reimburse(?:ment)?|payment|pay(?:out)?|send|transfer)\s+(?:address|to\s+(?:wallet|address)|funds\s+to)\b/i, 'asks for payment to a specific destination'],
  [/\bmark\s+(?:this\s+)?(?:as\s+)?urgent\b/i, 'tries to rush the review'],
  [/\b(?:approve|accept)\s+(?:this|immediately|automatically)\b/i, 'asks to be approved'],
]

// OCR often misreads 0/O and l/1 inside addresses, so match loosely.
// It also breaks long tokens with stray spaces.
const WALLET = /\b[0oO©][xX×](?:[0-9a-zA-Z] ?){30,44}/g

export function scanForInjection(text = '') {
  const flags = []
  const reasons = []
  let evidence = null
  for (const [re, why] of PATTERNS) {
    const m = text.match(re)
    if (m) {
      reasons.push(why)
      if (!evidence) {
        const start = Math.max(0, m.index - 30)
        evidence = text.slice(start, m.index + m[0].length + 50).replace(/\s+/g, ' ').trim()
      }
    }
  }
  if (reasons.length) {
    flags.push({
      code: 'prompt_injection',
      severity: 'block',
      message: `Receipt contains text that ${reasons.slice(0, 2).join(' and ')}.`,
      evidence,
    })
  }
  const wallets = [...new Set((text.match(WALLET) ?? []).map((w) => w.replace(/\s/g, '')))]
  if (wallets.length) {
    flags.push({
      code: 'wallet_address_on_receipt',
      severity: 'block',
      message: 'Receipt contains a crypto wallet address. Shop receipts never need one. Payments only go to your saved wallet.',
      evidence: wallets[0],
    })
  }
  return { flags, wallets }
}
