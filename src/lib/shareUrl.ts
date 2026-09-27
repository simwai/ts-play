export function buildShareServerUrl(id: string): string {
  const url = new URL(globalThis.location.href)
  url.searchParams.set('share', id)
  url.searchParams.delete('code')
  url.hash = ''
  return url.toString()
}

export function buildEmbeddedShareUrl(token: string): string {
  const url = new URL(globalThis.location.href)
  url.searchParams.delete('share')
  url.searchParams.delete('code')
  url.hash = `code=${token}`
  return url.toString()
}

export function loadSharedSnippetUrl(shareId: string): string {
  return new URL(
    `api/get.php?id=${encodeURIComponent(shareId)}`,
    document.baseURI
  ).toString()
}
