const active = (session) => (session?.memberships ?? []).filter((m) => m.status === 'active')

export const hasPerm = (session, societyId, perm) =>
  active(session).some((m) => m.societyId === societyId && m.permissions.includes(perm))

export const societiesWithPerm = (session, perm) =>
  active(session)
    .filter((m) => m.permissions.includes(perm))
    .map((m) => m.society)

export const isReviewer = (session) => societiesWithPerm(session, 'claims.review').length > 0

export const claimableSocieties = (session) =>
  active(session)
    .filter((m) => m.permissions.includes('claims.create') && m.society.reimbursement.status === 'enabled')
    .map((m) => m.society)
