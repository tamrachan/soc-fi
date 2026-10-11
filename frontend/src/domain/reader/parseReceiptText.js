// Turns raw OCR text into receipt fields with plain heuristics. Good enough for clear UK shop
// receipts; anything it can't find comes back null and the member types it in.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONEY = /([£€$])?\s?(\d{1,4}(?:,\d{3})*[.,]\s?\d{2})(?!\d)/g
const NOT_ITEM = /total|subtotal|vat|tax|change|cash|card|visa|master|amex|debit|credit|balance|tender|due|paid|contactless|approved|savings|discount|auth|tel|phone|receipt|invoice|order/i
const TOTAL_LINE = /\b(?:grand\s+)?total\b|amount\s+(?:due|paid)|balance\s+due|to\s+pay/i
const NOT_TOTAL = /sub\s*-?\s*total|total\s+(?:savings|discount|items?|qty|vat|tax)|vat\s+total/i

const CATEGORY_WORDS = [
  ['food', /pizza|domino|deliveroo|just eat|tesco|sainsbury|co-?op|aldi|lidl|asda|morrisons|m&s|waitrose|greggs|cafe|coffee|bakery|flour|butter|sugar|eggs?\b|milk|cream|chocolate|yeast|snack|crisps|drink|sandwich|meal|food|restaurant|kitchen/i],
  ['printing', /print|poster|banner|flyer|copy\s*shop|ryman|stationery|leaflet/i],
  ['travel', /train|rail|scotrail|lner|bus|stagecoach|coach|taxi|uber|fuel|petrol|ticket|ferry|airline/i],
  ['venue', /venue|room hire|hall hire|function room|booking fee|hire\b/i],
  ['equipment', /cable|adapter|hdmi|battery|tin|tray|whisk|mixer|bowl|equipment|tool|kit\b|argos|currys|amazon/i],
]

const toNumber = (s) => {
  let t = s.replace(/\s/g, '')
  if (/,\d{2}$/.test(t) && !t.includes('.')) t = t.replace(',', '.')
  return Number(t.replace(/,/g, ''))
}

const moneyOn = (line) => [...line.matchAll(MONEY)].map((m) => ({ symbol: m[1], value: toNumber(m[2]) })).filter((m) => m.value > 0)

const titleCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s)

function findDate(text) {
  const y4 = (y) => (y.length === 2 ? 2000 + Number(y) : Number(y))
  const ok = (y, m, d) => y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (m && ok(+m[1], +m[2], +m[3])) return iso(+m[1], +m[2], +m[3])
  // UK order: day / month / year
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)
  if (m && ok(y4(m[3]), +m[2], +m[1])) return iso(y4(m[3]), +m[2], +m[1])
  m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{2,4})\b/i)
  if (m) {
    const mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1
    if (mon && ok(y4(m[3]), mon, +m[1])) return iso(y4(m[3]), mon, +m[1])
  }
  return null
}

function findCurrency(text) {
  const count = (re) => (text.match(re) ?? []).length
  const gbp = count(/£|\bGBP\b/g)
  const eur = count(/€|\bEUR\b/g)
  const usd = count(/\$|\bUSD\b/g)
  if (eur > gbp && eur >= usd) return 'EUR'
  if (usd > gbp && usd > eur) return 'USD'
  return 'GBP' // UK receipts often print no symbol at all
}

function findMerchant(lines) {
  for (const line of lines.slice(0, 6)) {
    const letters = (line.match(/[a-z]/gi) ?? []).length
    if (letters < 3 || letters / line.length < 0.5) continue
    if (/receipt|invoice|vat\s*(no|reg)|tel|www\.|http|order|date|welcome|customer copy/i.test(line)) continue
    return titleCase(line.replace(/[^\w&'’.\- ]+/g, ' ').replace(/\s+/g, ' ').trim())
  }
  return null
}

function findTotal(lines) {
  const candidates = []
  lines.forEach((line, i) => {
    if (!TOTAL_LINE.test(line) || NOT_TOTAL.test(line)) return
    const here = moneyOn(line)
    const next = here.length ? here : moneyOn(lines[i + 1] ?? '')
    if (next.length) candidates.push(next[next.length - 1].value)
  })
  if (candidates.length) return Math.max(...candidates)
  // Fallback: the largest amount that isn't change given or cash tendered
  const all = lines.filter((l) => !/change|cash|tender/i.test(l)).flatMap(moneyOn).map((m) => m.value)
  return all.length ? Math.max(...all) : null
}

function findItems(lines) {
  const items = []
  lines.forEach((line, i) => {
    if (NOT_ITEM.test(line)) return
    const money = moneyOn(line)
    if (!money.length) return
    let desc = line.replace(MONEY, '').replace(/[×x*]\s*$/i, '').replace(/\s+/g, ' ').trim()
    // "2 × 0.95   1.90" on its own line: the description is on the line above
    if (!/[a-z]{3}/i.test(desc) && i > 0 && !moneyOn(lines[i - 1]).length) desc = lines[i - 1].trim()
    if (!/[a-z]{2}/i.test(desc)) return
    items.push({ desc, amount: money[money.length - 1].value })
  })
  return items
}

export function parseReceiptText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const category = CATEGORY_WORDS.find(([, re]) => re.test(text))?.[0] ?? null
  return {
    merchant: findMerchant(lines),
    date: findDate(text),
    total: findTotal(lines),
    currency: findCurrency(text),
    suggestedCategory: category,
    items: findItems(lines),
    rawText: text,
  }
}
