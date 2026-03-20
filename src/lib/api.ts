const API_URL = 'https://code.simonwaiblinger.de/api'

export type SharePayload = {
  tsCode: string
  jsCode: string
  packages: { name: string; version: string }[]
}

export async function shareSnippet(payload: SharePayload): Promise<any> {
  try {
    const res = await fetch(`${API_URL}/share.php`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return await res.json()
  } catch (error) {
    return { type: 'local', token: btoa(JSON.stringify(payload)), error }
  }
}

export async function loadSharedSnippet(id: string): Promise<any> {
  const res = await fetch(`${API_URL}/load.php?id=${id}`)
  return await res.json()
}
