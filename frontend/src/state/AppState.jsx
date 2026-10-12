import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../data/api.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [version, setVersion] = useState(0)
  const [session, setSession] = useState(undefined)

  useEffect(() => api.onChange(() => setVersion((v) => v + 1)), [])
  useEffect(() => {
    let live = true
    api.getSession().then((s) => live && setSession(s))
    return () => {
      live = false
    }
  }, [version])

  return <AppContext.Provider value={{ version, session }}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
export const useSession = () => useContext(AppContext).session

/** Run an async read; re-runs whenever the data source reports a change. Keeps stale data while refreshing. */
export function useApi(fn, deps = []) {
  const { version } = useApp()
  const [state, setState] = useState({ data: undefined, loading: true, error: null })
  useEffect(() => {
    let live = true
    fn()
      .then((data) => live && setState({ data, loading: false, error: null }))
      .catch((error) => live && setState((s) => ({ ...s, loading: false, error })))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps])
  return state
}

/** Wrap a mutation with pending/error state. `run` resolves to { ok, data } and never throws. */
export function useAction(fn) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const [state, setState] = useState({ pending: false, error: null })
  const run = useCallback(async (...args) => {
    setState({ pending: true, error: null })
    try {
      const data = await fnRef.current(...args)
      setState({ pending: false, error: null })
      return { ok: true, data }
    } catch (error) {
      setState({ pending: false, error })
      return { ok: false, data: undefined, error }
    }
  }, [])
  const clear = useCallback(() => setState({ pending: false, error: null }), [])
  return [run, state, clear]
}
