import { useRef } from 'react'
import { stagger } from 'animejs'
import StoryFrame from './StoryFrame.jsx'
import { captions, useScrollTimeline } from './useScrollTimeline.js'

const STEP = 2500
const STEPS = [
  { title: 'Open the claim', body: 'An email arrives when Priya submits, with the claim, the event and the warning. Every society’s claims wait in one queue.' },
  { title: 'See what the AI flagged', body: 'The warning sits right under the amount Priya changed, so the treasurer checks the one field that needs a human. The other checks already passed.' },
  { title: 'Approve, edit or deny', body: 'One decision. Requested edits and denials go back to Priya with a reason she can act on.' },
  { title: 'Sign on the Union’s Ledger', body: 'The hardware wallet’s own screen shows the real amount and recipient. The treasurer presses its button to sign, and USDC moves from the Union’s wallet to Priya’s.' },
]

const QUEUE = [
  ['Domino’s Pizza', 'Blockchain Society · Ledger hackathon', '£145.90', '1 warning'],
  ['Tesco Express', 'The Baking Society · bread workshop', '£14.85', '7/7'],
  ['Pixel Print Co.', 'FinTech Society · freshers’ fair', '£38.00', '7/7'],
]

const FIELDS = [
  ['Merchant', 'Domino’s Pizza'],
  ['Date', '3 Oct 2026'],
  ['For', 'Pizza · Ledger hackathon'],
]

export default function TreasurerChapter() {
  const ref = useRef(null)

  useScrollTimeline(ref, (tl, $) => {
    captions(tl, $, STEPS, STEP)
    const cursor = $('.cursor')
    const click = (at) => tl.add(cursor, { scale: [1, 0.8, 1], duration: 250 }, at)

    // 1. Email arrives, open the claim from the queue
    tl.add($('.mail-toast'), { opacity: [0, 1], translateY: [-16, 0], duration: 350, ease: 'outCubic' }, 100)
      .add($('.q-row'), { opacity: [0, 1], translateX: [-24, 0], duration: 350 }, stagger(160, { start: 600 }))
      .add(cursor, { opacity: [0, 1], translateX: [520, 330], translateY: [400, 205], duration: 700, ease: 'inOutCubic' }, 1300)
      .add($('.q-row.first'), { backgroundColor: ['rgba(18,19,23,0)', 'rgba(204,145,102,0.12)'], duration: 250 }, 1950)
    click(2000)

    // 2. The warning sits under the field that differs
    tl.add($('.w-inbox'), { opacity: [1, 0], duration: 250 }, 2500)
      .add($('.w-claim'), { opacity: [0, 1], duration: 300 }, 2600)
      .add($('.cf-row'), { opacity: [0, 1], translateY: [8, 0], duration: 250 }, stagger(150, { start: 2900 }))
      .add($('.cf-warn'), { opacity: [0, 1], translateY: [-6, 0], duration: 300 }, 3600)
      .add($('.cf-amount'), { borderColor: ['rgba(46,48,56,1)', 'rgba(204,145,102,0.9)'], duration: 300 }, 3600)
      .add($('.rc-highlight'), { opacity: [0, 1, 0.6, 1], scale: [1.15, 1, 1.04, 1], duration: 900 }, 3800)
      .add($('.cf-summary'), { opacity: [0, 1], duration: 300 }, 4300)

    // 3. Decide
    tl.add($('.decide-row button'), { opacity: [0, 1], translateY: [10, 0], duration: 300 }, stagger(120, { start: 5000 }))
      .add(cursor, { translateX: [330, 525], translateY: [205, 405], duration: 500 }, 5400)
      .add($('.d-deny'), { borderColor: ['rgba(46,48,56,1)', 'rgba(214,143,134,0.8)', 'rgba(46,48,56,1)'], duration: 450 }, 5800)
      .add(cursor, { translateX: [525, 415], duration: 350 }, 6150)
      .add($('.d-edit'), { borderColor: ['rgba(46,48,56,1)', 'rgba(204,145,102,0.8)', 'rgba(46,48,56,1)'], duration: 450 }, 6450)
      .add(cursor, { translateX: [415, 305], duration: 350 }, 6800)
    click(7150)
    tl.add($('.d-approve'), { backgroundColor: ['rgba(18,19,23,1)', 'rgba(143,181,154,0.22)'], borderColor: ['rgba(46,48,56,1)', 'rgba(143,181,154,1)'], duration: 250 }, 7200)

    // 4. Press the hardware button: page through the screen, then hold to sign
    const hint = $('.press-hint')
    const btn = $('.hw-btn-r')
    const ripple = $('.btn-ripple')
    const page = (i, at) => {
      if (i > 0) tl.add($(`.oled-${i - 1}`), { opacity: [1, 0], duration: 60 }, at)
      tl.add($(`.oled-${i}`), { opacity: [0, 1], duration: 60 }, at + 40)
    }
    const press = (at) =>
      tl
        .add(hint, { translateY: [0, 6, 0], duration: 180 }, at)
        .add(btn, { translateY: [0, 2, 0], duration: 180 }, at)
        .add(ripple, { opacity: [0.9, 0], scale: [0.6, 1.9], duration: 260, ease: 'outQuad' }, at + 60)

    tl.add(cursor, { opacity: [1, 0], duration: 200 }, 7500)
      .add($('.w-claim'), { opacity: [1, 0], duration: 250 }, 7600)
      .add($('.w-ledger'), { opacity: [0, 1], duration: 300 }, 7700)
      .add($('.hw-wallet'), { translateY: [40, 0], opacity: [0, 1], duration: 450, ease: 'outCubic' }, 7750)
      .add(hint, { opacity: [0, 1], duration: 250 }, 7950)
    press(8150)
    page(1, 8250)
    press(8400)
    page(2, 8500)
    press(8650)
    page(3, 8750)
    tl.add($('.hint-press'), { opacity: [1, 0], duration: 80 }, 8820)
      .add($('.hint-hold'), { opacity: [0, 1], duration: 80 }, 8850)
      .add(hint, { translateY: [0, 6], duration: 100 }, 8850)
      .add(btn, { translateY: [0, 2], duration: 100 }, 8850)
      .add($('.oled-progress'), { scaleX: [0, 1], duration: 450, ease: 'linear' }, 8900)
      .add(btn, { translateY: [2, 0], duration: 100 }, 9350)
    page(4, 9350)
    tl.add(hint, { opacity: [1, 0], duration: 200 }, 9400)
      .add($('.coin'), { opacity: [0, 1, 1, 0], translateY: [0, 40, 90, 120], translateX: [0, 30, 24, 0], scale: [0.6, 1, 1, 0.7], duration: 650, ease: 'inOutSine' }, 9400)
      .add($('.bal-from .old, .bal-to .old'), { opacity: [1, 0], duration: 150 }, 9800)
      .add($('.bal-from .new, .bal-to .new'), { opacity: [0, 1], duration: 150 }, 9850)
      .add($('.paid-chip'), { opacity: [0, 1], scale: [0.8, 1], duration: 150 }, 9850)
  })

  return (
    <StoryFrame sectionRef={ref} eyebrow="Union treasurer" title="Every claim checked. Only a person releases the money." steps={STEPS} height="520vh">
      <div className="window-wrap">
        <div className="window" aria-hidden="true">
          <div className="win-bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span className="mono">socfi · union treasurer</span>
          </div>

          <div className="win-body">
            <div className="scene w-inbox">
              <div className="mail-toast">
                <span className="mono">✉ New claim · just now</span>
                <b>Priya Raman · Pizza · Ledger hackathon · £145.90</b>
                <span className="copper">⚠ 1 warning: amount differs from the AI read</span>
              </div>
              <div className="w-title">
                <b>Review queue</b> <span className="mono faint">3 waiting</span>
              </div>
              {QUEUE.map(([merchant, sub, amt, checks], i) => (
                <div key={merchant} className={`q-row ${i === 0 ? 'first' : ''}`}>
                  <span>
                    {merchant}
                    <small>{sub}</small>
                  </span>
                  <span className={`q-checks mono ${i === 0 ? 'copper' : ''}`}>{checks}</span>
                  <span className="q-amt">{amt}</span>
                </div>
              ))}
            </div>

            <div className="scene w-claim">
              <div className="claim-receipt-mini">
                <div className="mini-receipt">
                  <b>DOMINO’S PIZZA</b>
                  <i>Order #4471 · 3 Oct 2026</i>
                  <hr />
                  <span>
                    Large pizza ×8<em>135.92</em>
                  </span>
                  <span>
                    Garlic bread ×2<em>9.98</em>
                  </span>
                  <hr />
                  <span className="mr-total">
                    TOTAL<em>£145.90</em>
                  </span>
                  <span className="rc-highlight" />
                </div>
              </div>
              <div className="claim-side">
                <span className="mono copper">CLM-0007 · Blockchain Society</span>
                <b className="claim-amt">£145.90 · Ledger hackathon</b>
                <span className="faint">Priya Raman · pizza for ~40 hackers</span>
                <div className="cf">
                  {FIELDS.map(([k, v]) => (
                    <div key={k} className="cf-row">
                      <span className="k">{k}</span>
                      <span>{v}</span>
                      <span className="ok">✓</span>
                    </div>
                  ))}
                  <div className="cf-row cf-amount">
                    <span className="k">Amount</span>
                    <span>£145.90</span>
                    <span className="copper">⚠</span>
                  </div>
                  <div className="cf-warn">Changed by Priya. The AI read £14.59, so check the receipt total.</div>
                </div>
                <span className="cf-summary">✓ 6 other checks passed · no hidden instructions</span>
                <div className="decide-row">
                  <button className="d-approve">✓ Approve</button>
                  <button className="d-edit">✎ Request edits</button>
                  <button className="d-deny">✕ Deny</button>
                </div>
              </div>
            </div>

            <div className="scene w-ledger">
              <div className="hw-wallet">
                <div className="hw-device">
                  <span className="hw-btn hw-btn-l" />
                  <span className="hw-btn hw-btn-r" />
                  <span className="btn-ripple" />
                  <div className="hw-body">
                    <div className="hw-screen">
                      <div className="oled oled-0">
                        <small>Review</small>
                        <b>Reimburse CLM-0007</b>
                      </div>
                      <div className="oled oled-1">
                        <small>Amount</small>
                        <b>185.29 USDC</b>
                      </div>
                      <div className="oled oled-2">
                        <small>To</small>
                        <b>0xFABB…694a</b>
                      </div>
                      <div className="oled oled-3">
                        <small>Hold right button</small>
                        <b>to sign</b>
                        <span className="oled-bar">
                          <span className="oled-progress" />
                        </span>
                      </div>
                      <div className="oled oled-4">
                        <b>✓ Signed</b>
                      </div>
                    </div>
                    <span className="hw-cap" />
                  </div>
                  <div className="press-hint">
                    <span className="hint-label">
                      <span className="hint-press">Press</span>
                      <span className="hint-hold">Hold</span>
                    </span>
                    <svg viewBox="0 0 24 30" width="20" height="26">
                      <path d="M12 2 V24 M4 16 L12 26 L20 16" />
                    </svg>
                  </div>
                </div>
                <span className="mono ld-label">Union Ledger · physical buttons</span>
              </div>

              <div className="wallets">
                <div className="wallet bal-from">
                  <span className="mono faint">Union treasury · Ledger</span>
                  <b>
                    <span className="amt">
                      <span className="old">12,400.00</span>
                      <span className="new">12,214.71</span>
                    </span>
                    USDC
                  </b>
                </div>
                <div className="flow-line" />
                <span className="coin">$</span>
                <div className="wallet bal-to">
                  <span className="mono faint">Priya · saved wallet</span>
                  <b>
                    <span className="amt">
                      <span className="old">0.00</span>
                      <span className="new">185.29</span>
                    </span>
                    USDC
                  </b>
                  <span className="paid-chip">Paid ✓</span>
                </div>
              </div>
            </div>
          </div>

          <span className="cursor">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M4 3l15 7-6.5 1.8L10 19z" />
            </svg>
          </span>
        </div>
      </div>
    </StoryFrame>
  )
}
