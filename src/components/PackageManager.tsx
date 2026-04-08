import React from 'react'
import { Badge } from './ui/Badge'
import { type InstalledPackage } from '../lib/types'

type Props = {
  packages: InstalledPackage[]
  isOpen: boolean
  contentHeight: number
}

export const PackageManager = React.memo(function PackageManager({
  packages,
  isOpen,
  contentHeight,
}: Props) {
  if (!isOpen) return null

  return (
    <div className="flex flex-col h-full bg-crust" style={{ height: `${contentHeight}rem` }}>
      <div className="flex-1 overflow-y-auto p-4">
        {packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-subtext1 opacity-40 select-none">
            <div className="mb-2 italic text-sm">No packages installed</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {packages.map((pkg) => (
              <div key={pkg.name} className="bg-mantle border border-surface0 rounded-lg p-3 hover:border-lavender/30 transition-colors group">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-mono text-sm text-lavender font-bold truncate mr-2">{pkg.name}</div>
                  <div className="text-xxs text-subtext1 bg-surface0 px-1.5 py-0.5 rounded shrink-0">v{pkg.version}</div>
                </div>
                {pkg.types && <Badge variant="info">types</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
