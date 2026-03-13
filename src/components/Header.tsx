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
    <header className='flex items-center justify-between px-1.5 h-9 bg-mantle border-b border-surface0 shrink-0 gap-1 relative z-40'>
      {/* Brand */}
      <div className='flex items-center gap-2'>
        <span className='text-xs font-bold tracking-tight font-mono'>
          TS<span className='text-mauve'>Play</span>
        </span>
      </div>

      {/* Tabs */}
      <div className='flex bg-surface0 rounded-md p-px gap-px shrink'>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
            }}
            className={`px-1.5 py-0.5 rounded-md border-none text-tiny font-semibold font-mono cursor-pointer tracking-wide uppercase transition-all duration-150 ${
              activeTab === tab
                ? 'bg-mauve/20 text-mauve'
                : 'bg-transparent text-overlay1'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className='flex items-center gap-1 shrink-0'>
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
          className='w-5.5 h-5.5 p-0'
        >
          {themeMode === 'mocha' ? <Sun size={14} /> : <Moon size={14} />}
        </IconButton>

        {/* Separator */}
        <div className='w-px h-2.5 bg-surface1 shrink-0' />

        {/* Copy all */}
        <IconButton
          onClick={handleCopyAll}
          title={`Copy all ${activeTab}`}
          tooltipAlign='right'
          size='sm'
          variant='surface'
          className={`w-5.5 h-5.5 p-0 ${copied ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </IconButton>

        {/* Delete all */}
        <IconButton
          onClick={handleDeleteAll}
          title={`Clear ${activeTab} editor`}
          tooltipAlign='right'
          size='sm'
          variant='surface'
          className='w-5.5 h-5.5 p-0 text-red hover:text-red'
        >
          <Trash2 size={14} />
        </IconButton>

        {/* Format */}
        <IconButton
          onClick={handleFormat}
          disabled={formatting}
          title='Format all files with Prettier (TS + JS + DTS)'
          tooltipAlign='right'
          size='sm'
          variant='surface'
          className={`w-5.5 h-5.5 p-0 ${formatSuccess ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}`}
        >
          {formatting ? (
            <Loader2
              size={14}
              className='animate-spin'
            />
          ) : formatSuccess ? (
            <Check size={14} />
          ) : (
            <Wand2 size={14} />
          )}
        </IconButton>

        {/* Separator */}
        <div className='w-px h-2.5 bg-surface1 shrink-0' />

        {/* Run */}
        <Button
          onClick={async () => doRun(false)}
          disabled={isRunning || compilerStatus !== 'ready'}
          variant='primary'
          title='Run (compile + execute)'
          tooltipAlign='right'
          className='font-mono tracking-wide px-2 py-0 h-5.5 min-w-5.5 text-xxs gap-1.5'
        >
          {isRunning ? (
            <Loader2
              size={12}
              className='animate-spin'
            />
          ) : (
            <Play
              size={12}
              fill='currentColor'
            />
          )}
          <span className='hidden sm:inline'>
            {isRunning ? 'Running…' : 'Run'}
          </span>
        </Button>

        {/* Separator */}
        <div className='w-px h-2.5 bg-surface1 shrink-0' />

        {/* Share */}
        <IconButton
          onClick={handleShare}
          title={sharing ? 'Sharing...' : 'Share snippet (expires in 7 days)'}
          tooltipAlign='right'
          size='sm'
          variant='surface'
          disabled={sharing}
          className={`w-5.5 h-5.5 p-0 ${shareSuccess ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}`}
        >
          {sharing ? (
            <Loader2
              size={14}
              className='animate-spin'
            />
          ) : shareSuccess ? (
            <Check size={14} />
          ) : (
            <Share2 size={14} />
          )}
        </IconButton>
      </div>
    </header>
  )
}
