import { Undo2, Redo2, Settings } from 'lucide-react'
import { IconButton } from './ui/IconButton'
import type { TabType } from '../App'

type StatusBarProps = {
  compilerStatus: 'loading' | 'ready' | 'error'
  activeTab: TabType
  jsDirty: boolean
  handleUndo: () => void
  handleRedo: () => void
  onOpenSettings: () => void
  compactForKeyboard: boolean
}

export function StatusBar({
  compilerStatus,
  activeTab,
  jsDirty,
  handleUndo,
  handleRedo,
  onOpenSettings,
  compactForKeyboard,
}: StatusBarProps) {
  const statusLabel =
    compilerStatus === 'loading'
      ? '⏳ Loading…'
      : compilerStatus === 'error'
        ? '✗ No compiler'
        : '✓ TS ready'
  const statusColorClass =
    compilerStatus === 'ready'
      ? 'text-green'
      : compilerStatus === 'error'
        ? 'text-red'
        : 'text-yellow'

  return (
    <div
      className='flex items-center justify-between px-3.5 bg-crust border-b border-surface0 shrink-0 relative z-30 gap-2'
      style={{ height: compactForKeyboard ? 20 : 24 }}
    >
      <div className='flex items-center justify-start flex-1 min-w-0'>
        <span
          className={`text-xxs font-mono tracking-wide truncate ${statusColorClass}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className='flex items-center justify-center shrink-0 min-w-0'>
        <span className='text-xxs text-overlay0 font-mono truncate'>
          {activeTab === 'ts'
            ? 'TypeScript'
            : activeTab === 'js'
              ? 'JavaScript'
              : 'Declarations'}
          {activeTab === 'js' && jsDirty && (
            <span className='ml-1.5 text-peach'>● modified</span>
          )}
        </span>
      </div>

      <div className='flex items-center justify-end gap-1 flex-1 min-w-0'>
        <IconButton
          onClick={handleUndo}
          title='Undo'
          tooltipAlign='right'
          size='sm'
          variant='ghost'
          className='w-5 h-5 p-0 text-overlay1 hover:text-text shrink-0'
        >
          <Undo2 size={12} />
        </IconButton>
        <IconButton
          onClick={handleRedo}
          title='Redo'
          tooltipAlign='right'
          size='sm'
          variant='ghost'
          className='w-5 h-5 p-0 text-overlay1 hover:text-text shrink-0'
        >
          <Redo2 size={12} />
        </IconButton>
        <div className='w-px h-2.5 bg-surface1 mx-0.5 shrink-0' />
        <IconButton
          onClick={onOpenSettings}
          title='Settings'
          tooltipAlign='right'
          size='sm'
          variant='ghost'
          className='w-5 h-5 p-0 text-overlay1 hover:text-text shrink-0'
        >
          <Settings size={12} />
        </IconButton>
      </div>
    </div>
  )
}
