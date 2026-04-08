import { useEffect } from 'react'
import { useMachine } from '@xstate/react'
import { useSetAtom } from 'jotai'
import { packageMachine } from '../lib/machines/packageMachine'
import { packageManagerStatusAtom } from '../lib/store'
import {
  type InstalledPackage,
  type ConsoleMessage,
  type PackageManagerStatus,
} from '../lib/types'

export function usePackageManager(
  _tsCode: string,
  _addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void,
  _showNodeWarnings: boolean = true
) {
  const [state] = useMachine(packageMachine)
  const setStatus = useSetAtom(packageManagerStatusAtom)

  useEffect(() => {
    setStatus(state.value as PackageManagerStatus)
  }, [state.value, setStatus])

  return {
    installedPackages: [] as InstalledPackage[],
    packageTypings: {} as Record<string, string>,
    installQueue: Promise.resolve(),
  }
}
