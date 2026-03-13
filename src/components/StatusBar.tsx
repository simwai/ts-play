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
      className='flex items-center justify-between px-2 md:px-4 bg-crust border-b border-surface0 shrink-0 relative z-30 gap-2 md:gap-4 h-8 md:h-9'
      style={compactForKeyboard ? { height: '1.5rem' } : undefined}
    >
      <div className='flex items-center justify-start flex-1 min-w-0'>
        <span
          className={`text-3xs md:text-xs font-mono tracking-wide truncate ${statusColorClass}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className='flex items-center justify-center shrink-0 min-w-0'>
        <span className='text-3xs md:text-xs text-overlay0 font-mono truncate'>
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

      <div className='flex items-center justify-end gap-1 md:gap-1.5 flex-1 min-w-0'>
        <IconButton
          onClick={handleUndo}
          title='Undo'
          tooltipAlign='right'
          size='xs'
          variant='ghost'
          className='text-overlay1 hover:text-text'
        >
          <Undo2 className='w-3 h-3 md:w-4 md:h-4' />
        </IconButton>
        <IconButton
          onClick={handleRedo}
          title='Redo'
          tooltipAlign='right'
          size='xs'
          variant='ghost'
          className='text-overlay1 hover:text-text'
        >
          <Redo2 className='w-3 h-3 md:w-4 md:h-4' />
        </IconButton>
        <div className='w-px h-3 md:h-4 bg-surface1 mx-0.5 md:mx-1 shrink-0' />
        <IconButton
          onClick={onOpenSettings}
          title='Settings'
          tooltipAlign='right'
          size='xs'
          variant='ghost'
          className='text-overlay1 hover:text-text'
        >
          <Settings className='w-3 h-3 md:w-4 md:h-4' />
        </IconButton>
      </div>
    </div>
  )
}
