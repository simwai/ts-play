import { Undo2, Redo2, Settings } from 'lucide-react'
import { IconButton } from './ui/IconButton'
import type { TabType } from '../lib/constants'

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
      className='flex items-center justify-between px-4 bg-crust border-b border-surface0 shrink-0 relative z-30 gap-4'
      style={{ height: compactForKeyboard ? '1.5rem' : '2rem' }}
    >
      <div className='flex items-center justify-start flex-1 min-w-0'>
        <span
          className={`text-xs font-mono tracking-wide truncate ${statusColorClass}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className='flex items-center justify-center shrink-0 min-w-0'>
        <span className='text-xs text-overlay0 font-mono truncate'>
          {activeTab === 'ts'
            ? 'TypeScript'
            : activeTab === 'js'
              ? 'JavaScript'
              : 'Declarations'}
          {activeTab === 'js' && jsDirty && (
            <span className='ml-2 text-peach'>● modified</span>
          )}
        </span>
      </div>

      <div className='flex items-center justify-end gap-1.5 flex-1 min-w-0'>
        <IconButton
          onClick={handleUndo}
          title='Undo'
          tooltipAlign='right'
          size='xs'
          variant='ghost'
          className='text-overlay1 hover:text-text'
        >
          <Undo2 size={14} />
        </IconButton>
        <IconButton
          onClick={handleRedo}
          title='Redo'
          tooltipAlign='right'
          size='xs'
          variant='ghost'
          className='text-overlay1 hover:text-text'
        >
          <Redo2 size={14} />
        </IconButton>
        <div className='w-px h-3 bg-surface1 mx-1 shrink-0' />
        <IconButton
          onClick={onOpenSettings}
          title='Settings'
          tooltipAlign='right'
          size='xs'
          variant='ghost'
          className='text-overlay1 hover:text-text'
        >
          <Settings size={14} />
        </IconButton>
      </div>
    </div>
  )
}
