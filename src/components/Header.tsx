import {
  Sun,
  Moon,
  Copy,
  Check,
  Trash2,
  Wand2,
  Loader2,
  Play,
  Share2,
} from 'lucide-react'
import { IconButton } from './ui/IconButton'
import { Button } from './ui/Button'
import type { ThemeMode } from '../lib/theme'
import { TABS, type TabType } from '../lib/constants'

type HeaderProps = {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode | ((m: ThemeMode) => ThemeMode)) => void
  handleCopyAll: () => void
  copied: boolean
  handleDeleteAll: () => void
  handleFormat: () => void
  formatting: boolean
  formatSuccess: boolean
  doRun: (skipDirtyCheck?: boolean) => void
  isRunning: boolean
  compilerStatus: 'loading' | 'ready' | 'error'
  handleShare: () => void
  sharing: boolean
  shareSuccess: boolean
}

export function Header({
  activeTab,
  setActiveTab,
  themeMode,
  setThemeMode,
  handleCopyAll,
  copied,
  handleDeleteAll,
  handleFormat,
  formatting,
  formatSuccess,
  doRun,
  isRunning,
  compilerStatus,
  handleShare,
  sharing,
  shareSuccess,
}: HeaderProps) {
  return (
    <header className='flex items-center justify-between px-3 h-10 md:h-12 bg-mantle border-b border-surface0 shrink-0 gap-3 relative z-40'>
      {/* Brand */}
      <div className='flex items-center gap-2'>
        <span className='text-xs md:text-sm font-bold tracking-tight font-mono'>
          TS<span className='text-mauve'>Play</span>
        </span>
      </div>

      {/* Tabs */}
      <div className='flex bg-surface0 rounded-md p-0.5 gap-0.5 shrink'>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
            }}
            className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded border-none text-xxs md:text-xs font-semibold font-mono cursor-pointer tracking-wide uppercase transition-all duration-150 ${
              activeTab === tab
                ? 'bg-mauve/20 text-mauve shadow-sm'
                : 'bg-transparent text-overlay1 hover:text-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className='flex items-center gap-1.5 md:gap-2 shrink-0'>
        {/* Theme toggle */}
        <IconButton
          onClick={() => {
            setThemeMode((m) => (m === 'mocha' ? 'latte' : 'mocha'))
          }}
          title={
            themeMode === 'mocha'
              ? 'Switch to Latte (light)'
              : 'Switch to Mocha (dark)'
          }
          tooltipAlign='right'
          variant='surface'
          className='w-6 h-6 md:w-8 md:h-8'
        >
          {themeMode === 'mocha' ? <Sun className='w-3.5 h-3.5 md:w-4 md:h-4' /> : <Moon className='w-3.5 h-3.5 md:w-4 md:h-4' />}
        </IconButton>

        {/* Separator */}
        <div className='w-px h-3.5 md:h-4 bg-surface1 shrink-0 mx-0.5 md:mx-1' />

        {/* Copy all */}
        <IconButton
          onClick={handleCopyAll}
          title={`Copy all ${activeTab}`}
          tooltipAlign='right'
          variant='surface'
          className={`w-6 h-6 md:w-8 md:h-8 ${copied ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}`}
        >
          {copied ? <Check className='w-3.5 h-3.5 md:w-4 md:h-4' /> : <Copy className='w-3.5 h-3.5 md:w-4 md:h-4' />}
        </IconButton>

        {/* Delete all */}
        <IconButton
          onClick={handleDeleteAll}
          title={`Clear ${activeTab} editor`}
          tooltipAlign='right'
          variant='surface'
          className='w-6 h-6 md:w-8 md:h-8 text-red hover:text-red'
        >
          <Trash2 className='w-3.5 h-3.5 md:w-4 md:h-4' />
        </IconButton>

        {/* Format */}
        <IconButton
          onClick={handleFormat}
          disabled={formatting}
          title='Format all files with Prettier (TS + JS + DTS)'
          tooltipAlign='right'
          variant='surface'
          className={`w-6 h-6 md:w-8 md:h-8 ${formatSuccess ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}`}
        >
          {formatting ? (
            <Loader2
              className='w-3.5 h-3.5 md:w-4 md:h-4 animate-spin'
            />
          ) : formatSuccess ? (
            <Check className='w-3.5 h-3.5 md:w-4 md:h-4' />
          ) : (
            <Wand2 className='w-3.5 h-3.5 md:w-4 md:h-4' />
          )}
        </IconButton>

        {/* Separator */}
        <div className='w-px h-3.5 md:h-4 bg-surface1 shrink-0 mx-0.5 md:mx-1' />

        {/* Run */}
        <Button
          onClick={async () => doRun(false)}
          disabled={isRunning || compilerStatus !== 'ready'}
          variant='primary'
          title='Run (compile + execute)'
          tooltipAlign='right'
          className='font-mono tracking-wide px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm h-6 md:h-8'
        >
          {isRunning ? (
            <Loader2
              className='w-3 h-3 md:w-3.5 md:h-3.5 animate-spin'
            />
          ) : (
            <Play
              className='w-3 h-3 md:w-3.5 md:h-3.5'
              fill='currentColor'
            />
          )}
          <span className='hidden sm:inline'>
            {isRunning ? 'Running…' : 'Run'}
          </span>
        </Button>

        {/* Separator */}
        <div className='w-px h-3.5 md:h-4 bg-surface1 shrink-0 mx-0.5 md:mx-1' />

        {/* Share */}
        <IconButton
          onClick={handleShare}
          title={sharing ? 'Sharing...' : 'Share snippet (expires in 7 days)'}
          tooltipAlign='right'
          variant='surface'
          disabled={sharing}
          className={`w-6 h-6 md:w-8 md:h-8 ${shareSuccess ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}`}
        >
          {sharing ? (
            <Loader2
              className='w-3.5 h-3.5 md:w-4 md:h-4 animate-spin'
            />
          ) : shareSuccess ? (
            <Check className='w-3.5 h-3.5 md:w-4 md:h-4' />
          ) : (
            <Share2 className='w-3.5 h-3.5 md:w-4 md:h-4' />
          )}
        </IconButton>
      </div>
    </header>
  )
}
