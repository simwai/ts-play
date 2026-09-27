export function computePackageDiff(
  current: Set<string>,
  previous: Set<string>,
  systemDeps: Set<string>
): { toAdd: string[]; toRemove: string[] } {
  const toAdd = [...current].filter((x) => !previous.has(x))
  const toRemove = [...previous].filter(
    (x) => !current.has(x) && !systemDeps.has(x) && !x.startsWith('@types/')
  )
  return { toAdd: toAdd.sort(), toRemove: toRemove.sort() }
}
