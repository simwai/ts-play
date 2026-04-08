import type { CompilerStatus, TabType } from '../lib/types'
import {
  Sun,
  Moon,
  Copy,
  Check,
  Trash2,
  Play,
  Square,
  Settings,
  Wand2,
  Loader2,
  Share2,
} from 'lucide-react'
import { IconButton } from './ui/IconButton'
import { Button } from './ui/Button'
import { TABS } from '../lib/constants'

type HeaderProps = {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  isDarkMode: boolean
  setIsDarkMode: (val: boolean) => void
  handleCopyAll: () => void
  copied: boolean
  handleDeleteAll: () => void
  doRun: (skipDirtyCheck?: boolean) => void
  isRunning: boolean
  compilerStatus: CompilerStatus
  onSettings: () => void
  stopCode?: () => void
  handleFormat: () => void
  formatting: boolean
  formatSuccess: boolean
  handleShare: () => void
  sharing: boolean
  shareSuccess: boolean
}

export function Header({
  activeTab,
  onTabChange,
  isDarkMode,
  setIsDarkMode,
  handleCopyAll,
  copied,
  handleDeleteAll,
  doRun,
  isRunning,
  compilerStatus,
  onSettings,
  stopCode,
  handleFormat,
  formatting,
  formatSuccess,
  handleShare,
  sharing,
  shareSuccess,
}: HeaderProps) {
  return (
    <header className='flex items-center justify-between px-2 h-12 bg-mantle border-b border-surface0 shrink-0'>
      <div className='flex bg-surface0 rounded-md p-0.5 gap-0.5'>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab as TabType)}
            className={`px-2 py-1 rounded text-xs font-bold font-mono ${activeTab === tab ? 'bg-lavender text-crust' : 'text-subtext1 hover:text-text'}`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className='flex items-center gap-1'>
        <IconButton
          onClick={() => setIsDarkMode(!isDarkMode)}
          title='Toggle Theme'
          variant='surface'
          size='sm'
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        <IconButton
          onClick={onSettings}
          title='Settings'
          variant='surface'
          size='sm'
        >
          <Settings size={16} />
        </IconButton>
        <div className='w-px h-4 bg-surface1 mx-1' />
        <IconButton
          onClick={handleCopyAll}
          title='Copy All'
          variant='surface'
          size='sm'
          className={copied ? 'text-green' : ''}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </IconButton>
        <IconButton
          onClick={handleDeleteAll}
          title='Clear Editor'
          variant='surface'
          size='sm'
          className='text-red'
        >
          <Trash2 size={16} />
        </IconButton>
        <IconButton
          onClick={handleFormat}
          disabled={formatting}
          title='Format'
          variant='surface'
          size='sm'
          className={formatSuccess ? 'text-green' : ''}
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
        <div className='w-px h-4 bg-surface1 mx-1' />
        {isRunning ? (
          <Button
            onClick={stopCode}
            variant='danger'
            size='sm'
            className='h-8'
          >
            <Square
              size={14}
              className='mr-2 fill-current'
            />{' '}
            Stop
          </Button>
        ) : (
          <Button
            onClick={() => doRun(false)}
            disabled={compilerStatus !== 'ready'}
            variant='primary'
            size='sm'
            className='h-8'
          >
            <Play
              size={14}
              className='mr-2 fill-current'
            />{' '}
            Run
          </Button>
        )}
        <div className='w-px h-4 bg-surface1 mx-1' />
        <IconButton
          onClick={handleShare}
          disabled={sharing}
          title='Share'
          variant='surface'
          size='sm'
          className={shareSuccess ? 'text-green' : ''}
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
