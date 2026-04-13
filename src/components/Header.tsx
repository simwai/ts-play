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
  Settings,
} from 'lucide-react'
import { IconButton } from './ui/IconButton'
import { Button } from './ui/Button'
import { TABS, type TabType } from '../lib/constants'

type HeaderProps = {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  isDarkMode: boolean
  setIsDarkMode: (val: boolean) => void
  onCopyAll: () => void
  copied: boolean
  onDeleteAll: () => void
  onRun: (skipDirtyCheck?: boolean) => void
  isRunning: boolean
  compilerStatus: CompilerStatus
  onSettings: () => void
  stopCode?: () => void
}

export function Header({
  activeTab,
  onTabChange,
  isDarkMode,
  setIsDarkMode,
  onCopyAll,
  copied,
  onDeleteAll,
  onRun,
  isRunning,
  compilerStatus,
  onSettings,
  stopCode,
}: HeaderProps) {
  return (
    <header className='flex items-center justify-between px-1.5 md:px-3 h-9 md:h-12 bg-mantle border-b border-surface0 shrink-0 gap-1.5 md:gap-3 relative z-40'>
      {/* Brand */}
      <div className='flex items-center gap-1.5 md:gap-2'>
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
              onTabChange(tab)
            }}
            className={`px-1.5 py-0.5 md:px-3 md:py-1.5 rounded border-none text-4xs md:text-xs font-semibold font-mono cursor-pointer tracking-wide uppercase transition-all duration-150 ${
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
      <div className='flex items-center gap-1 md:gap-2 shrink-0'>
        {/* Theme toggle */}
        <IconButton
          onClick={() => {
            setIsDarkMode(!isDarkMode)
          }}
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

        {/* Settings */}
        <IconButton
          onClick={onSettings}
          title='Settings'
          tooltipAlign='right'
          variant='surface'
          size='sm'
        >
          <Settings className='w-3 h-3 md:w-4 md:h-4' />
        </IconButton>

        {/* Separator */}
        <div className='w-px h-3.5 md:h-5 bg-surface1 shrink-0 mx-0.5 md:mx-1' />

        {/* Copy all */}
        <IconButton
          onClick={onCopyAll}
          title={`Copy all ${activeTab}`}
          tooltipAlign='right'
          variant='surface'
          size='sm'
          className={
            copied
              ? 'text-green border-green bg-green/15 hover:bg-green/20'
              : ''
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
          onClick={onDeleteAll}
          title={`Clear ${activeTab} editor`}
          tooltipAlign='right'
          variant='surface'
          size='sm'
          className='text-red hover:text-red'
        >
          <Trash2 className='w-3 h-3 md:w-4 md:h-4' />
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
            onClick={async () => onRun(false)}
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
      </div>
    </header>
  )
}
