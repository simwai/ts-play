import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { Eraser } from 'lucide-react'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { PanelHeader } from './ui/PanelHeader'
import Ansi from 'ansi-to-html'

export type ConsoleMessage = {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'dir'
  args: any[]
  ts: number
}

type Props = {
  messages: ConsoleMessage[]
  onClear: () => void
  isOpen: boolean
  onToggle: () => void
  contentHeight: number
  trueColorEnabled?: boolean
  showNodeWarnings?: boolean
  activeTab: 'console' | 'problems' | 'packages'
  onTabChange: (tab: 'console' | 'problems' | 'packages') => void
  problemCount: number
}

function typeVariant(
  type: ConsoleMessage['type']
): 'error' | 'warn' | 'info' | 'default' {
  if (type === 'error') return 'error'
  if (type === 'warn' || type === 'trace') return 'warn'
  if (type === 'info' || type === 'debug' || type === 'dir') return 'info'
  return 'default'
}

function typeLabel(type: ConsoleMessage['type']): string {
  if (type === 'error') return 'ERR'
  if (type === 'warn') return 'WRN'
  if (type === 'info') return 'INF'
  if (type === 'debug') return 'DBG'
  if (type === 'trace') return 'TRC'
  if (type === 'dir') return 'DIR'
  return 'LOG'
}

function typeColorClass(type: ConsoleMessage['type']): string {
  if (type === 'error') return 'text-red'
  if (type === 'warn' || type === 'trace') return 'text-yellow'
  if (type === 'info' || type === 'debug' || type === 'dir') return 'text-blue'
  return 'text-text'
}

type FilterType = 'all' | 'log' | 'info' | 'warn' | 'error'

// ── Memoised filter button ───────────────────────────────────────
const FilterButton = React.memo(function FilterButton({
  type,
  label,
  active,
  onChange,
}: {
  type: FilterType
  label: string
  active: boolean
  onChange: (type: FilterType) => void
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(type)
    },
    [onChange, type]
  )

  return (
    <button
      onClick={handleClick}
      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all duration-200 ${
        active ? 'bg-mauve/20 text-mauve' : 'text-overlay1 hover:text-text'
      }`}
    >
      {label}
    </button>
  )
})

// ── Memoised tab button ─────────────────────────────────────────
type TabButtonProps = {
  id: 'console' | 'problems' | 'packages'
  label: string
  count?: number
  variant?: 'error' | 'warn' | 'info' | 'default'
  activeTab: 'console' | 'problems' | 'packages'
  onTabChange: (tab: 'console' | 'problems' | 'packages') => void
  isOpen: boolean
  onToggle: () => void
}

const TabButton = React.memo(function TabButton({
  id,
  label,
  count,
  variant,
  activeTab,
  onTabChange,
  isOpen,
  onToggle,
}: TabButtonProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onTabChange(id)
      if (!isOpen) onToggle()
    },
    [id, onTabChange, isOpen, onToggle]
  )

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all duration-200 ${
        activeTab === id
          ? 'bg-surface0 text-mauve shadow-sm'
          : 'text-overlay1 hover:text-text hover:bg-surface0/50'
      }`}
    >
      <span className='text-[10px] font-mono font-bold uppercase tracking-wider'>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <Badge
          label={String(count)}
          variant={variant}
          className='scale-90'
        />
      )}
    </button>
  )
})

// ── Memoised message row ────────────────────────────────────────
const MessageRow = React.memo(function MessageRow({
  message,
  ansiConvert,
  trueColorEnabled,
}: {
  message: ConsoleMessage
  ansiConvert: any
  trueColorEnabled: boolean
}) {
  const rawArgs = message.args
  const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs]
  const fullText = args.map(String).join(' ')
  const hasAnsi = trueColorEnabled && /[\u001b\u009b]/.test(fullText)

  let content: React.ReactNode
  if (
    hasAnsi &&
    ansiConvert &&
    typeof (ansiConvert as any).toHtml === 'function'
  ) {
    try {
      const html = (ansiConvert as any).toHtml(fullText)
      content = (
        <div
          className='m-0 p-0 text-xxs md:text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono'
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    } catch {
      content = (
        <pre
          className={`m-0 p-0 text-xxs md:text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono ${typeColorClass(message.type)}`}
        >
          {fullText}
        </pre>
      )
    }
  } else {
    content = (
      <pre
        className={`m-0 p-0 text-xxs md:text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono ${typeColorClass(message.type)}`}
      >
        {fullText}
      </pre>
    )
  }

  return (
    <div
      data-testid='console-message'
      className={`flex items-start gap-2.5 px-3 py-1.5 border-b border-surface0/40 select-text ${
        message.type === 'error'
          ? 'bg-red/5'
          : message.type === 'warn'
            ? 'bg-yellow/5'
            : 'bg-transparent'
      }`}
    >
      <Badge
        label={typeLabel(message.type)}
        variant={typeVariant(message.type)}
        className='mt-0.5'
      />
      {content}
    </div>
  )
})

// ── Main Console ─────────────────────────────────────────────────
export const Console = React.memo(function Console({
  messages,
  onClear,
  isOpen,
  onToggle,
  contentHeight,
  trueColorEnabled = true,
  showNodeWarnings = true,
  activeTab,
  onTabChange,
  problemCount,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<FilterType>('all')

  const ansiConvert = useMemo(() => {
    try {
      const Ctor = (Ansi as any).default || Ansi
      if (typeof Ctor !== 'function') return null
      return new Ctor({ newline: false, escapeHtml: true, stream: false })
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (isOpen && activeTab === 'console') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, filter, activeTab])

  const safeMessages = Array.isArray(messages) ? messages : []
  const errors = safeMessages.filter((m) => m.type === 'error').length
  const warns = safeMessages.filter((m) => m.type === 'warn').length

  const filteredMessages = useMemo(() => {
    return safeMessages.filter((m) => {
      if (
        !showNodeWarnings &&
        m.args.some((arg: string) => arg.startsWith('(node:'))
      )
        return false
      if (filter === 'all') return true
      if (filter === 'log') return m.type === 'log'
      if (filter === 'info')
        return m.type === 'info' || m.type === 'debug' || m.type === 'dir'
      if (filter === 'warn') return m.type === 'warn' || m.type === 'trace'
      if (filter === 'error') return m.type === 'error'
      return true
    })
  }, [safeMessages, filter, showNodeWarnings])

  const handleFilterChange = useCallback(
    (type: FilterType) => setFilter(type),
    []
  )

  // Memoise the tab bar
  const tabBar = useMemo(
    () => (
      <div className='flex items-center gap-1'>
        <TabButton
          id='console'
          label='Console'
          count={safeMessages.length}
          activeTab={activeTab}
          onTabChange={onTabChange}
          isOpen={isOpen}
          onToggle={onToggle}
        />
        <TabButton
          id='problems'
          label='Problems'
          count={problemCount}
          variant={problemCount > 0 ? 'error' : 'default'}
          activeTab={activeTab}
          onTabChange={onTabChange}
          isOpen={isOpen}
          onToggle={onToggle}
        />
        <TabButton
          id='packages'
          label='Packages'
          activeTab={activeTab}
          onTabChange={onTabChange}
          isOpen={isOpen}
          onToggle={onToggle}
        />
      </div>
    ),
    [
      safeMessages.length,
      problemCount,
      activeTab,
      onTabChange,
      isOpen,
      onToggle,
    ]
  )

  // Memoise the filter bar
  const filterBar = useMemo(
    () => (
      <div className='flex items-center gap-2 px-4 py-1.5 bg-base/30 border-b border-surface0/20'>
        <div className='flex bg-surface0/50 rounded px-1 py-0.5 gap-1 shrink-0'>
          <FilterButton
            type='all'
            label='All'
            active={filter === 'all'}
            onChange={handleFilterChange}
          />
          <FilterButton
            type='log'
            label='Log'
            active={filter === 'log'}
            onChange={handleFilterChange}
          />
          <FilterButton
            type='info'
            label='Info'
            active={filter === 'info'}
            onChange={handleFilterChange}
          />
          <FilterButton
            type='warn'
            label='Warn'
            active={filter === 'warn'}
            onChange={handleFilterChange}
          />
          <FilterButton
            type='error'
            label='Err'
            active={filter === 'error'}
            onChange={handleFilterChange}
          />
        </div>
        <div className='flex items-center gap-1.5 ml-auto'>
          {errors > 0 && (
            <Badge
              label={`${errors} err`}
              variant='error'
            />
          )}
          {warns > 0 && (
            <Badge
              label={`${warns} warn`}
              variant='warn'
            />
          )}
        </div>
      </div>
    ),
    [filter, handleFilterChange, errors, warns]
  )

  return (
    <div
      className='flex flex-col border-t border-surface0 bg-mantle shrink-0'
      data-testid='console-container'
    >
      <PanelHeader
        label='Console'
        isOpen={isOpen}
        onToggle={onToggle}
        left={tabBar}
        right={
          safeMessages.length > 0 ? (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              variant='secondary'
              size='xs'
              title='Clear console'
              data-testid='console-clear-button'
              tooltipAlign='right'
              className='h-6 px-2'
            >
              <Eraser size={11} />
              <span className='hidden sm:inline'>Clear</span>
            </Button>
          ) : undefined
        }
      />

      {isOpen && activeTab === 'console' && (
        <>
          {filterBar}
          <div
            className='overflow-y-auto overflow-x-hidden'
            style={{ height: `${contentHeight}rem` }}
          >
            {filteredMessages.length === 0 ? (
              <div className='flex items-center justify-center h-full text-overlay0 text-xxs md:text-xs italic font-mono'>
                {messages.length === 0
                  ? 'No output yet — press Run to execute'
                  : 'No matches for selected filter'}
              </div>
            ) : (
              filteredMessages.map((m, idx) => (
                <MessageRow
                  key={`${m.ts}-${idx}`}
                  message={m}
                  ansiConvert={ansiConvert}
                  trueColorEnabled={trueColorEnabled}
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </>
      )}
    </div>
  )
})
