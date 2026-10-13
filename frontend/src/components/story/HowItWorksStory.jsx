import AgentChapter from './AgentChapter.jsx'
import MemberChapter from './MemberChapter.jsx'
import TreasurerChapter from './TreasurerChapter.jsx'
import './story.css'

/** The scroll-driven walkthrough: member claims, the agent checks, then the Union treasurer signs. */
export default function HowItWorksStory() {
  return (
    <div className="how-it-works">
      <MemberChapter />
      <div className="story-interlude">
        <span className="mono">What the agent checks</span>
      </div>
      <AgentChapter />
      <div className="story-interlude">
        <span className="mono">Meanwhile, at the Union</span>
      </div>
      <TreasurerChapter />
    </div>
  )
}
