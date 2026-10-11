import { Link, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { Empty } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import SignUp from './pages/SignUp.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import Account from './pages/Account.jsx'
import Societies from './pages/Societies.jsx'
import CommitteeAccess from './pages/CommitteeAccess.jsx'
import SetupList from './pages/SetupList.jsx'
import SocietySetup from './pages/SocietySetup.jsx'
import MyClaims from './pages/MyClaims.jsx'
import ClaimForm from './pages/ClaimForm.jsx'
import ClaimDetail from './pages/ClaimDetail.jsx'
import ReviewQueue from './pages/ReviewQueue.jsx'
import ReviewDetail from './pages/ReviewDetail.jsx'
import Payments from './pages/Payments.jsx'
import AuditLog from './pages/AuditLog.jsx'
import DemoReceipts from './pages/DemoReceipts.jsx'
import HowItWorks from './pages/HowItWorks.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="verify" element={<VerifyEmail />} />
        <Route path="account" element={<Account />} />
        <Route path="societies" element={<Societies />} />
        <Route path="committee" element={<CommitteeAccess />} />
        <Route path="setup" element={<SetupList />} />
        <Route path="setup/:societyId" element={<SocietySetup />} />
        <Route path="claims" element={<MyClaims />} />
        <Route path="claims/new" element={<ClaimForm />} />
        <Route path="claims/:id" element={<ClaimDetail />} />
        <Route path="claims/:id/edit" element={<ClaimForm />} />
        <Route path="review" element={<ReviewQueue />} />
        <Route path="review/:id" element={<ReviewDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="audit" element={<AuditLog />} />
        <Route path="demo/receipts" element={<DemoReceipts />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route
          path="*"
          element={
            <Empty title="Nothing here">
              <Link className="link" to="/">
                Back to overview
              </Link>
            </Empty>
          }
        />
      </Route>
    </Routes>
  )
}
