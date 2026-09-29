import React from 'react'
import { Console, type ConsoleMessage } from './Console'
import { Problems } from './Problems'
import { PackageManager, type InstalledPackage } from './PackageManager'
import type { TSDiagnostic } from '../lib/types'

type BottomPanelsProps = {
  isBottomSectionRendered: boolean
  isBottomPanelVisible: boolean
  isResizing: boolean
  handleResizeStart: (e: React.MouseEvent | React.TouchEvent) => void
  panelHeight: number
  messages: ConsoleMessage[]
  clearMessages: () => void
  consoleOpen: boolean
  setPackageManagerOpen: (val: boolean) => void
  trueColorEnabled: boolean
  showNodeWarnings: boolean
  activeBottomTab: 'console' | 'problems' | 'packages'
  setActiveBottomTab: (tab: 'console' | 'problems' | 'packages') => void
  monacoDiagnostics: TSDiagnostic[]
  handleJumpToProblem: (line: number, col: number) => void
  installedPackages: InstalledPackage[]
}

export function BottomPanels({
  isBottomSectionRendered,
  isBottomPanelVisible,
  isResizing,
  handleResizeStart,
  panelHeight,
  messages,
  clearMessages,
  consoleOpen,
  setPackageManagerOpen,
  trueColorEnabled,
  showNodeWarnings,
  activeBottomTab,
  setActiveBottomTab,
  monacoDiagnostics,
  handleJumpToProblem,
  installedPackages,
}: BottomPanelsProps) {
  if (!isBottomSectionRendered) return null

  const resizeHandleColorClass = isResizing ? 'bg-peach' : 'bg-surface0'

  return (
    <>
      {isBottomPanelVisible && (
        <div
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          className={`h-2 border-b border-surface0 cursor-ns-resize flex items-center justify-center shrink-0 transition-colors duration-160 relative ${resizeHandleColorClass}`}
          title='Drag to resize'
        >
          <div className='w-10 h-1 bg-overlay0 rounded-sm opacity-50' />
        </div>
      )}

      <div className='overflow-hidden flex flex-col shrink-0 bg-base'>
        <Console
          messages={messages}
          onClear={clearMessages}
          isOpen={consoleOpen}
          onToggle={() => setPackageManagerOpen(false)}
          contentHeight={panelHeight}
          trueColorEnabled={trueColorEnabled}
          showNodeWarnings={showNodeWarnings}
          activeTab={activeBottomTab}
          onTabChange={setActiveBottomTab}
          problemCount={monacoDiagnostics.length}
        />

        <Problems
          diagnostics={monacoDiagnostics}
          isOpen={consoleOpen && activeBottomTab === 'problems'}
          contentHeight={panelHeight}
          onJumpToProblem={handleJumpToProblem}
        />

        <PackageManager
          packages={installedPackages}
          isOpen={consoleOpen && activeBottomTab === 'packages'}
          contentHeight={panelHeight}
        />
      </div>
    </>
  )
}
