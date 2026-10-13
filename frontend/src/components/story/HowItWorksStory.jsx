import AgentChapter from './AgentChapter.jsx'
import MemberChapter from './MemberChapter.jsx'
import TreasurerChapter from './TreasurerChapter.jsx'
import './story.css'
import { AGENT_NAME } from '../../config.js'

/** The scroll-driven walkthrough: member claims, the agent checks, then the Union treasurer signs. */
export default function HowItWorksStory() {
  return (
    <div className="how-it-works">
      <MemberChapter />
      <div className="story-interlude">
        <span className="mono">What {AGENT_NAME} checks</span>
      </div>
      <AgentChapter />
      <div className="story-interlude">
        <span className="mono">Meanwhile, at the Union</span>
      </div>
      <TreasurerChapter />
    </div>
  )
}
