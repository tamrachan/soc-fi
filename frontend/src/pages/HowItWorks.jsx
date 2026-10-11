import { PageHead } from '../components/ui.jsx'
import HowItWorksStory from '../components/story/HowItWorksStory.jsx'

export default function HowItWorks() {
  return (
    <>
      <PageHead
        eyebrow="How it works"
        title={
          <>
            Two people, one Ledger. <em>Scroll through a claim.</em>
          </>
        }
      />
      <HowItWorksStory />
    </>
  )
}
