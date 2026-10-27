import { useEffect, useState } from 'react'

type State<T> = { data: T | null; error: string | null; loading: boolean }

/**
 * Fetches whenever `deps` change. Keeps the previous data while refetching so charts dim
 * instead of flashing empty, and ignores responses from superseded requests.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })
  // Deps are primitives (mode, day, ...), so a serialized key is a stable, lint-visible dependency.
  const key = JSON.stringify(deps)

  useEffect(() => {
    let current = true
    setState((s) => ({ ...s, loading: true }))
    fetcher()
      .then((data) => current && setState({ data, error: null, loading: false }))
      .catch((e: Error) => current && setState((s) => ({ ...s, error: e.message, loading: false })))
    return () => {
      current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fetcher` is a fresh closure each render; `key` captures its inputs
  }, [key])

  return state
}
