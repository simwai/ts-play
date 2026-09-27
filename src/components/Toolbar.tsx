import type { CompilerStatus } from '../lib/types'
import {
  Sun,
  Moon,
  Copy,
  Check,
  Trash2,
  Wand2,
  Loader2,
  Play,
  Square,
  Share2,
} from 'lucide-react'
import { IconButton } from './ui/IconButton'
import { Button } from './ui/Button'
import { TABS, type TabType } from '../lib/constants'

type ToolbarProps = {
  activeTab: TabType
  isDarkMode: boolean
  setIsDarkMode: (val: boolean) => void
  handleCopyAll: () => void
  copied: boolean
  handleDeleteAll: () => void
  handleFormat: () => void
  formatting: boolean
  formatSuccess: boolean
  handleRun: (skipDirtyCheck?: boolean) => void
  isRunning: boolean
  compilerStatus: CompilerStatus
  handleShare: () => void
  sharing: boolean
  shareSuccess: boolean
  stopCode?: () => void
}

export function Toolbar({
  activeTab,
  isDarkMode,
  setIsDarkMode,
  handleCopyAll,
  copied,
  handleDeleteAll,
  handleFormat,
  formatting,
  formatSuccess,
  handleRun,
  isRunning,
  compilerStatus,
  handleShare,
  sharing,
  shareSuccess,
  stopCode,
}: ToolbarProps) {
  return (
    <div className='flex items-center gap-1 md:gap-2 shrink-0'>
      {/* Theme toggle */}
      <IconButton
        onClick={() => setIsDarkMode(!isDarkMode)}
        title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        tooltipAlign='right'
        variant='surface'
        size='sm'
      >
        {isDarkMode ? (
          <Sun className='w-3 h-3 md:w-4 md:h-4' />
        ) : (
          <Moon className='w-3 h-3 md:w-4 md:h-4' />
        )}
      </IconButton>

      {/* Separator */}
      <div className='w-px h-3.5 md:h-5 bg-surface1 shrink-0 mx-0.5 md:mx-1' />

      {/* Copy all */}
      <IconButton
        onClick={handleCopyAll}
        title={`Copy all ${activeTab}`}
        tooltipAlign='right'
        variant='surface'
        size='sm'
        className={
          copied ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''
        }
      >
        {copied ? (
          <Check className='w-3 h-3 md:w-4 md:h-4' />
        ) : (
          <Copy className='w-3 h-3 md:w-4 md:h-4' />
        )}
      </IconButton>

      {/* Delete all */}
      <IconButton
        onClick={handleDeleteAll}
        title={`Clear ${activeTab} editor`}
        tooltipAlign='right'
        variant='surface'
        size='sm'
        className='text-red hover:text-red'
      >
        <Trash2 className='w-3 h-3 md:w-4 md:h-4' />
      </IconButton>

      {/* Format */}
      <IconButton
        onClick={handleFormat}
        disabled={formatting}
        title='Format all files with Prettier (TS + JS + DTS)'
        tooltipAlign='right'
        variant='surface'
        size='sm'
        className={
          formatSuccess
            ? 'text-green border-green bg-green/15 hover:bg-green/20'
            : ''
        }
      >
        {formatting ? (
          <Loader2 className='w-3 h-3 md:w-4 md:h-4 animate-spin' />
        ) : formatSuccess ? (
          <Check className='w-3 h-3 md:w-4 md:h-4' />
        ) : (
          <Wand2 className='w-3 h-3 md:w-4 md:h-4' />
        )}
      </IconButton>

      {/* Separator */}
      <div className='w-px h-3.5 md:h-5 bg-surface1 shrink-0 mx-0.5 md:mx-1' />

      {/* Run / Stop */}
      {isRunning ? (
        <Button
          onClick={() => stopCode?.()}
          data-testid='header-stop-button'
          variant='primary'
          size='sm'
          title='Stop execution'
          tooltipAlign='right'
          className='font-mono tracking-wide bg-red! border-red! hover:bg-red/80 active:bg-red/90'
        >
          <Square
            className='w-3 h-3 md:w-4 md:h-4'
            fill='currentColor'
          />
          <span className='hidden sm:inline'>Stop</span>
        </Button>
      ) : (
        <Button
          onClick={async () => handleRun(false)}
          data-testid='header-run-button'
          disabled={compilerStatus !== 'ready'}
          variant='primary'
          size='sm'
          title='Run (compile + execute)'
          tooltipAlign='right'
          className='font-mono tracking-wide'
        >
          <Play
            className='w-3 h-3 md:w-4 md:h-4'
            fill='currentColor'
          />
          <span className='hidden sm:inline'>Run</span>
        </Button>
      )}

      {/* Separator */}
      <div className='w-px h-3.5 md:h-5 bg-surface1 shrink-0 mx-0.5 md:mx-1' />

      {/* Share */}
      <IconButton
        onClick={handleShare}
        title={sharing ? 'Sharing...' : 'Share snippet (expires in 7 days)'}
        tooltipAlign='right'
        variant='surface'
        size='sm'
        disabled={sharing}
        className={
          shareSuccess
            ? 'text-green border-green bg-green/15 hover:bg-green/20'
            : ''
        }
      >
        {sharing ? (
          <Loader2 className='w-3 h-3 md:w-4 md:h-4 animate-spin' />
        ) : shareSuccess ? (
          <Check className='w-3 h-3 md:w-4 md:h-4' />
        ) : (
          <Share2 className='w-3 h-3 md:w-4 md:h-4' />
        )}
      </IconButton>
    </div>
  )
}
