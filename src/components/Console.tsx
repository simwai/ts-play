import React, { useEffect, useRef, useState, useMemo } from 'react'
import {
  Terminal,
  Eraser,
  ChevronDown,
  Search,
  X,
} from 'lucide-react'
import Ansi from 'ansi-to-html'
import { Button } from './ui/Button'
import { Badge, type BadgeVariant } from './ui/Badge'
import { type ConsoleMessage } from '../lib/types'
import { cn } from '../lib/utils'

type Props = {
  messages: ConsoleMessage[]
  onClear: () => void
  isOpen: boolean
  onToggle: () => void
  showNodeWarnings?: boolean
  activeTab: 'console' | 'problems' | 'packages'
  onTabChange: (tab: 'console' | 'problems' | 'packages') => void
  problemCount: number
  trueColorEnabled?: boolean
}

type FilterType = 'all' | 'log' | 'info' | 'warn' | 'error'


export const Console = React.memo(function Console({
  messages,
  onClear,
  isOpen,
  onToggle,
  showNodeWarnings = true,
  activeTab,
  onTabChange,
  problemCount,
  trueColorEnabled = true,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')

  const converter = useMemo(
    () => new Ansi({ newline: true, escapeXML: true }),
    []
  )

  const filteredMessages = useMemo(() => {
    const searchLower = search.toLowerCase()
    return messages.filter((m) => {
      if (!showNodeWarnings && m.type === 'system') return false
      if (filter !== 'all') {
        if (filter === 'log' && m.type !== 'log') return false
        if (filter === 'info' && !['info', 'debug', 'dir'].includes(m.type))
          return false
        if (filter === 'warn' && !['warn', 'trace'].includes(m.type))
          return false
        if (filter === 'error' && m.type !== 'error') return false
      }
      if (
        searchLower &&
        !m.args.some((a) => String(a).toLowerCase().includes(searchLower))
      )
        return false
      return true
    })
  }, [messages, showNodeWarnings, filter, search])

  useEffect(() => {
    if (isOpen && activeTab === 'console' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isOpen, activeTab, filteredMessages])

  const FilterButton = ({
    type,
    label,
  }: {
    type: FilterType
    label: string
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setFilter(type)
      }}
      className={cn(
        'px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors',
        filter === type
          ? 'bg-lavender/20 text-lavender'
          : 'text-subtext1 hover:text-text'
      )}
    >
      {label}
    </button>
  )

  const TabButton = ({
    id,
    label,
    count,
    variant,
  }: {
    id: 'console' | 'problems' | 'packages'
    label: string
    count?: number
    variant?: BadgeVariant
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onTabChange(id)
      }}
      className={cn(
        'relative flex items-center gap-1.5 px-3 h-full transition-all border-b-2 outline-none',
        activeTab === id
          ? 'border-lavender text-text font-bold'
          : 'border-transparent text-subtext1 hover:text-text'
      )}
    >
      <span className='text-[10px] uppercase tracking-[0.05em]'>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className={cn(
          "flex items-center justify-center min-w-[1rem] h-3.5 px-1 rounded-full text-[9px] font-bold",
          variant === 'error' ? "bg-red text-crust" :
          variant === 'warn' ? "bg-yellow text-crust" :
          "bg-surface2 text-text"
        )}>
          {count}
        </span>
      )}
    </button>
  )

  const errors = messages.filter((m) => m.type === 'error').length
  const warns = messages.filter((m) => m.type === 'warn').length

  return (
    <div
      className='flex flex-col border-t border-surface0 bg-crust shrink-0 overflow-hidden h-full'
      data-testid='console-container'
    >
      <div
        className='flex items-center justify-between h-8 bg-mantle border-b border-surface0/30'
      >
        <div className='flex items-center h-full ml-3 gap-1'>
          <TabButton
            id='problems'
            label='Problems'
            count={problemCount}
            variant={problemCount > 0 ? 'error' : 'default'}
          />
          <TabButton
            id='console'
            label='Output'
            count={messages.length}
          />
          <TabButton
            id='packages'
            label='Packages'
          />
        </div>

        <div className='flex items-center gap-1 pr-1 h-full'>
          {activeTab === 'console' && isOpen && messages.length > 0 && (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              variant='ghost'
              size='sm'
              className='h-6 w-6 p-0 text-subtext1 hover:text-red hover:bg-surface0 rounded transition-colors'
              title="Clear Output"
            >
              <Eraser size={13} />
            </Button>
          )}
          <Button
            onClick={onToggle}
            variant='ghost'
            size='sm'
            className='h-6 w-6 p-0 text-subtext1 hover:bg-surface0 rounded transition-colors'
          >
            <ChevronDown
              className={cn(
                'w-4 h-4 transition-transform duration-300',
                isOpen && 'rotate-180'
              )}
            />
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className='flex flex-col bg-crust flex-1 min-h-0'>
          {activeTab === 'console' && (
            <div className='flex items-center gap-2 px-3 h-7 bg-mantle/30 border-b border-surface0/10'>
              <div className='flex bg-surface0/50 rounded p-0.5 gap-0.5 shrink-0'>
                <FilterButton type='all' label='All' />
                <FilterButton type='log' label='Log' />
                <FilterButton type='info' label='Info' />
                <FilterButton type='warn' label='Warn' />
                <FilterButton type='error' label='Err' />
              </div>

              <div className='relative flex-1 max-w-[12rem] ml-2'>
                <Search
                  size={11}
                  className='absolute left-1.5 top-1/2 -translate-y-1/2 text-overlay0'
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder='Filter...'
                  className='w-full bg-crust border border-surface0 rounded px-6 py-0 text-[9px] h-5 text-text focus:outline-none focus:border-lavender'
                />
                {search && (
                  <X
                    size={9}
                    className='absolute right-1.5 top-1/2 -translate-y-1/2 text-overlay0 cursor-pointer hover:text-text'
                    onClick={() => setSearch('')}
                  />
                )}
              </div>

              <div className='flex items-center gap-2 ml-auto'>
                {errors > 0 && (
                  <Badge label={`${errors} E`} variant='error' className="h-4 px-1.5" />
                )}
                {warns > 0 && (
                  <Badge label={`${warns} W`} variant='warn' className="h-4 px-1.5" />
                )}
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            className='flex-1 overflow-y-auto p-2 font-mono text-[11px] selection:bg-lavender/30 scrollbar-thin'
          >
            {activeTab === 'console' ? (
              filteredMessages.length === 0 ? (
                <div className='h-full flex flex-col items-center justify-center text-subtext1 opacity-30 italic'>
                  <Terminal
                    size={24}
                    className='mb-2 opacity-10'
                  />
                  {messages.length === 0 ? 'No output' : 'No matching entries'}
                </div>
              ) : (
                <div className="space-y-0">
                  {filteredMessages.map((msg, i) => {
                    const fullText = msg.args.join(' ')
                    const hasAnsi =
                      trueColorEnabled && /[\u001b\u009b]/.test(fullText)
                    return (
                      <div
                        key={`${msg.ts}-${i}`}
                        className={cn(
                          'flex items-start gap-3 py-0.5 px-2 hover:bg-surface0/10 transition-colors group leading-[1.4]',
                          msg.type === 'error' && 'text-red bg-red/5',
                          msg.type === 'warn' && 'text-yellow bg-yellow/5'
                        )}
                      >
                        <span className="opacity-0 group-hover:opacity-20 text-[8px] min-w-[36px] text-right pt-[3px] transition-opacity pointer-events-none tabular-nums">
                          {new Date(msg.ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <div className='flex-1 min-w-0'>
                          <div className='whitespace-pre-wrap break-all'>
                            {hasAnsi ? (
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: converter.toHtml(fullText),
                                }}
                              />
                            ) : (
                              fullText
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
})
