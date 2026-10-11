import { useRef } from 'react'
import { stagger, steps } from 'animejs'
import StoryFrame from './StoryFrame.jsx'
import { captions, tap, useScrollTimeline } from './useScrollTimeline.js'

const STEP = 2000
const STEPS = [
  { title: 'Snap the receipt', body: 'Priya, on the Blockchain Society committee, bought pizza for the society’s hackathon with Ledger. She photographs the receipt in the app.' },
  { title: 'The AI reads it', body: 'Merchant, date, total and category fill themselves in. The AI only suggests values. It can’t submit or pay anything.' },
  { title: 'Wrong? Override it', body: 'The AI misread the total as £14.59. Priya corrects it to £145.90. The change is marked, so the Union treasurer will check it against the receipt.' },
  { title: 'Add the event and submit', body: 'She says what it was for (pizza for the Ledger hackathon), ticks each field against the receipt and submits.' },
  { title: 'Done', body: 'The Union treasurer gets an email with the claim, the event and the amount warning. Any payment goes to the wallet saved on Priya’s account.' },
]

const ROWS = [
  ['Merchant', 'Domino’s Pizza'],
  ['Date', '3 Oct 2026'],
  ['Category', 'Food & drink'],
]

function MiniReceipt({ className = '' }) {
  return (
    <div className={`mini-receipt ${className}`}>
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
    </div>
  )
}

export default function MemberChapter() {
  const ref = useRef(null)

  useScrollTimeline(ref, (tl, $) => {
    captions(tl, $, STEPS, STEP)
    const t = $('.tap')
    const typed = { clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], ease: steps(12) }

    // 1. Snap
    tl.add($('.s-cam .mini-receipt'), { translateY: [260, 0], rotate: [-8, -2], duration: 900, ease: 'outCubic' }, 0)
      .add($('.vf-corner'), { scale: [1.12, 1], opacity: [0.4, 1], duration: 400 }, 900)
      .add(t, { translateX: [150, 150], translateY: [520, 520], duration: 1 }, 1290)
    tap(tl, t, 1300)
    tl.add($('.flash'), { opacity: [0, 0.9, 0], duration: 350 }, 1550)

    // 2. AI reads
    tl.add($('.s-cam'), { opacity: [1, 0], duration: 250 }, 1950)
      .add($('.s-form'), { opacity: [0, 1], duration: 300 }, 2050)
      .add($('.ph-scan'), { translateY: [0, 100], opacity: [1, 1, 0], duration: 900, ease: 'linear' }, 2250)
      .add($('.ph-row .val-ai'), { ...typed, duration: 350 }, stagger(280, { start: 2450 }))
      .add($('.ph-row .ai'), { opacity: [0, 1], scale: [0.6, 1], duration: 250 }, stagger(280, { start: 2650 }))

    // 3. Override the misread amount: marked on the claim, nothing is sent yet
    tl.add($('.row-amount'), { borderColor: ['rgba(46,48,56,1)', 'rgba(214,143,134,0.9)'], duration: 300 }, 4050)
      .add(t, { translateX: [230, 230], translateY: [335, 335], duration: 1 }, 4290)
    tap(tl, t, 4300)
    tl.add($('.amt-ai'), { opacity: [1, 0], translateY: [0, -10], duration: 300 }, 4600)
      .add($('.amt-fix'), { opacity: [0, 1], translateY: [10, 0], duration: 300 }, 4700)
      .add($('.row-amount'), { borderColor: ['rgba(214,143,134,0.9)', 'rgba(204,145,102,0.9)'], duration: 300 }, 4700)
      .add($('.row-amount .ai'), { opacity: [1, 0], duration: 200 }, 4700)
      .add($('.ph-warn'), { opacity: [0, 1], translateY: [8, 0], duration: 350 }, 4950)

    // 4. Event details, check, submit
    tl.add(t, { translateX: [170, 170], translateY: [425, 425], duration: 1 }, 6040)
    tap(tl, t, 6050)
    tl.add($('.row-for .val-typed'), { ...typed, duration: 600 }, 6300)
      .add($('.ph-row .tick'), { opacity: [0, 1], scale: [0, 1], duration: 220 }, stagger(160, { start: 6950 }))
      .add($('.ph-confirm .box'), { backgroundColor: ['rgba(0,0,0,0)', 'rgba(143,181,154,1)'], borderColor: ['rgba(70,72,83,1)', 'rgba(143,181,154,1)'], duration: 250 }, 7400)
      .add($('.ph-submit'), { opacity: [0.35, 1], duration: 200 }, 7450)
      .add(t, { translateX: [150, 150], translateY: [542, 542], duration: 1 }, 7590)
    tap(tl, t, 7600)
    tl.add($('.ph-submit'), { scale: [1, 0.94, 1], duration: 250 }, 7700)

    // 5. Submitted: the email to the Union treasurer carries the warning
    tl.add($('.s-form'), { opacity: [1, 0], duration: 300 }, 8000)
      .add($('.s-done'), { opacity: [0, 1], duration: 300 }, 8100)
      .add($('.done-ring'), { strokeDashoffset: [100, 0], duration: 600, ease: 'outCubic' }, 8250)
      .add($('.done-check'), { strokeDashoffset: [100, 0], duration: 400, ease: 'outCubic' }, 8700)
      .add($('.s-done .done-text > *'), { opacity: [0, 1], translateY: [10, 0], duration: 250 }, stagger(120, { start: 8900 }))
      .add($('.mail-card'), { opacity: [0, 1], translateY: [30, 0], duration: 400, ease: 'outCubic' }, 9300)
  })

  return (
    <StoryFrame sectionRef={ref} eyebrow="Committee member · Blockchain Society" title="From pizza receipt to claim in a minute." steps={STEPS} height="560vh">
      <div className="phone-wrap">
        <div className="phone" aria-hidden="true">
          <div className="ph-status">
            <span>9:41</span>
            <span className="ph-island" />
            <span>5G</span>
          </div>

          <div className="scene s-cam">
            <span className="vf-label mono">Scan receipt</span>
            <div className="viewfinder">
              {['tl', 'tr', 'bl', 'br'].map((c) => (
                <span key={c} className={`vf-corner ${c}`} />
              ))}
              <MiniReceipt />
            </div>
            <div className="shutter" />
            <div className="flash" />
          </div>

          <div className="scene s-form">
            <div className="ph-head">
              <span className="mono copper">New claim</span>
              <b>Blockchain Society</b>
            </div>
            <div className="ph-thumb">
              <MiniReceipt className="small" />
              <span className="ph-scan" />
            </div>
            <div className="ph-fields">
              {ROWS.map(([k, v]) => (
                <div key={k} className="ph-row">
                  <span className="k">{k}</span>
                  <span className="v">
                    <span className="val-ai">{v}</span>
                  </span>
                  <span className="ai">AI</span>
                  <span className="tick">✓</span>
                </div>
              ))}
              <div className="ph-row row-amount">
                <span className="k">Amount</span>
                <span className="v">
                  <span className="val-ai amt-ai">£14.59</span>
                  <span className="amt-fix">£145.90</span>
                </span>
                <span className="ai">AI</span>
                <span className="tick">✓</span>
              </div>
              <div className="ph-warn">
                <b>⚠ Differs from the AI read (£14.59)</b>
                Your Union treasurer will check this against the receipt.
              </div>
              <div className="ph-row row-for">
                <span className="k">For</span>
                <span className="v">
                  <span className="val-typed">Pizza · Ledger hackathon</span>
                </span>
                <span />
                <span className="tick">✓</span>
              </div>
            </div>
            <div className="ph-confirm">
              <span className="box">✓</span> I’ve checked every field
            </div>
            <div className="ph-submit">Submit claim</div>
          </div>

          <div className="scene s-done">
            <svg viewBox="0 0 120 120" width="84" height="84">
              <circle className="done-ring" cx="60" cy="60" r="52" pathLength="100" />
              <path className="done-check" d="M38 62 l15 15 l30 -32" pathLength="100" />
            </svg>
            <div className="done-text">
              <b>Claim submitted</b>
              <span className="mono">CLM-0007 · In review</span>
            </div>
            <div className="mail-card">
              <span className="mail-to mono">✉ Emailed to the Union treasurer</span>
              <b>New claim · Blockchain Society</b>
              <span>Pizza · Ledger hackathon · £145.90</span>
              <span className="mail-warn">⚠ Amount differs from the AI read (£14.59)</span>
            </div>
          </div>

          <span className="tap" />
        </div>
      </div>
    </StoryFrame>
  )
}
