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
import { TABS, type TabType } from '../App'

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
    <header className='flex items-center justify-between px-4 h-12 bg-mantle border-b border-surface0 shrink-0 gap-4 relative z-40'>
      {/* Brand */}
      <div className='flex items-center gap-2'>
        <span className='text-sm font-bold tracking-tight font-mono'>
          TS<span className='text-mauve'>Play</span>
        </span>
      </div>

      {/* Tabs */}
      <div className='flex bg-surface0 rounded-lg p-1 gap-1 shrink'>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
            }}
            className={`px-3 py-1.5 rounded-md border-none text-xs font-semibold font-mono cursor-pointer tracking-wide uppercase transition-all duration-150 ${
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
      <div className='flex items-center gap-2 shrink-0'>
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
          size='sm'
          variant='surface'
        >
          {themeMode === 'mocha' ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>

        {/* Separator */}
        <div className='w-px h-4 bg-surface1 shrink-0 mx-1' />

        {/* Copy all */}
        <IconButton
          onClick={handleCopyAll}
          title={`Copy all ${activeTab}`}
          tooltipAlign='right'
          size='sm'
          variant='surface'
          className={copied ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </IconButton>

        {/* Delete all */}
        <IconButton
          onClick={handleDeleteAll}
          title={`Clear ${activeTab} editor`}
          tooltipAlign='right'
          size='sm'
          variant='surface'
          className='text-red hover:text-red'
        >
          <Trash2 size={16} />
        </IconButton>

        {/* Format */}
        <IconButton
          onClick={handleFormat}
          disabled={formatting}
          title='Format all files with Prettier (TS + JS + DTS)'
          tooltipAlign='right'
          size='sm'
          variant='surface'
          className={formatSuccess ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}
        >
          {formatting ? (
            <Loader2
              size={16}
              className='animate-spin'
            />
          ) : formatSuccess ? (
            <Check size={16} />
          ) : (
            <Wand2 size={16} />
          )}
        </IconButton>

        {/* Separator */}
        <div className='w-px h-4 bg-surface1 shrink-0 mx-1' />

        {/* Run */}
        <Button
          onClick={async () => doRun(false)}
          disabled={isRunning || compilerStatus !== 'ready'}
          variant='primary'
          size='sm'
          title='Run (compile + execute)'
          tooltipAlign='right'
          className='font-mono tracking-wide'
        >
          {isRunning ? (
            <Loader2
              size={14}
              className='animate-spin'
            />
          ) : (
            <Play
              size={14}
              fill='currentColor'
            />
          )}
          <span className='hidden sm:inline'>
            {isRunning ? 'Running…' : 'Run'}
          </span>
        </Button>

        {/* Separator */}
        <div className='w-px h-4 bg-surface1 shrink-0 mx-1' />

        {/* Share */}
        <IconButton
          onClick={handleShare}
          title={sharing ? 'Sharing...' : 'Share snippet (expires in 7 days)'}
          tooltipAlign='right'
          size='sm'
          variant='surface'
          disabled={sharing}
          className={shareSuccess ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}
        >
          {sharing ? (
            <Loader2
              size={16}
              className='animate-spin'
            />
          ) : shareSuccess ? (
            <Check size={16} />
          ) : (
            <Share2 size={16} />
          )}
        </IconButton>
      </div>
    </header>
  )
}
