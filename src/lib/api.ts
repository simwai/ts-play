export async function shareSnippet(ts: string, tsconfig: string): Promise<string> {
  // Mocking share API for now to focus on core logic
  const state = JSON.stringify({ ts, tsconfig })
  const encoded = btoa(encodeURIComponent(state))
  return `${window.location.origin}/#code=${encoded}`
}
