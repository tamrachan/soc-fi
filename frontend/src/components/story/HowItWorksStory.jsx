import MemberChapter from './MemberChapter.jsx'
import TreasurerChapter from './TreasurerChapter.jsx'
import './story.css'

/** The scroll-driven walkthrough: committee member claims, then the Union treasurer signs. */
export default function HowItWorksStory() {
  return (
    <div className="how-it-works">
      <MemberChapter />
      <div className="story-interlude">
        <span className="mono">Meanwhile, at the Union</span>
      </div>
      <TreasurerChapter />
    </div>
  )
}
