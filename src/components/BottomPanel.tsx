import { Console } from './Console'
import { Problems } from './Problems'
import { PackageManager } from './PackageManager'
import type { TSDiagnostic } from '../lib/types'

type BottomPanelProps = {
  compactForKeyboard: boolean
  consoleOpen: boolean
  packageManagerOpen: boolean
  panelHeight: number
  isResizing: boolean
  handleResizeStart: (e: React.MouseEvent | React.TouchEvent) => void
  messages: import('./Console').ConsoleMessage[]
  clearMessages: () => void
  onToggle: () => void
  trueColorEnabled: boolean
  showNodeWarnings: boolean
  activeBottomTab: 'console' | 'problems' | 'packages'
  onTabChange: (tab: 'console' | 'problems' | 'packages') => void
  monacoDiagnostics: TSDiagnostic[]
  handleJumpToProblem: (line: number, col: number) => void
  installedPackages: import('./PackageManager').InstalledPackage[]
}

export function BottomPanel({
  compactForKeyboard,
  consoleOpen,
  packageManagerOpen,
  panelHeight,
  isResizing,
  handleResizeStart,
  messages,
  clearMessages,
  onToggle,
  trueColorEnabled,
  showNodeWarnings,
  activeBottomTab,
  onTabChange,
  monacoDiagnostics,
  handleJumpToProblem,
  installedPackages,
}: BottomPanelProps) {
  if (compactForKeyboard) return null

  const shouldShowBottom = consoleOpen || packageManagerOpen

  if (!shouldShowBottom) return null

  return (
    <>
      <div
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
        className={`h-2 border-b border-surface0 cursor-ns-resize flex items-center justify-center shrink-0 transition-colors duration-160 relative ${isResizing ? 'bg-peach' : 'bg-surface0'}`}
        title='Drag to resize'
      >
        <div className='w-10 h-1 bg-overlay0 rounded-sm opacity-50' />
      </div>
      <div className='overflow-hidden flex flex-col shrink-0 bg-base'>
        <Console
          messages={messages}
          onClear={clearMessages}
          isOpen={consoleOpen}
          onToggle={onToggle}
          contentHeight={panelHeight}
          trueColorEnabled={trueColorEnabled}
          showNodeWarnings={showNodeWarnings}
          activeTab={activeBottomTab}
          onTabChange={onTabChange}
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
