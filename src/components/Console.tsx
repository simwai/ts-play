import React, { useRef, useEffect, useMemo, useState } from 'react'
import { Eraser, ChevronDown, Terminal, Search, X } from 'lucide-react'
import { Badge, type BadgeVariant } from './ui/Badge'
import { Button } from './ui/Button'
import Ansi from 'ansi-to-html'
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

function typeVariant(type: ConsoleMessage['type']): BadgeVariant {
  if (type === 'error') return 'error'
  if (type === 'warn' || type === 'trace') return 'warn'
  return 'info'
}

function typeLabel(type: ConsoleMessage['type']): string {
  return type.toUpperCase().slice(0, 3)
}

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
    id: any
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
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all',
        activeTab === id
          ? 'bg-surface0 text-lavender shadow-sm'
          : 'text-subtext1 hover:text-text'
      )}
    >
      <span className='text-[10px] font-bold uppercase tracking-wider'>
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

  const errors = messages.filter((m) => m.type === 'error').length
  const warns = messages.filter((m) => m.type === 'warn').length

  return (
    <div
      className='flex flex-col border-t border-surface0 bg-mantle shrink-0 overflow-hidden h-full'
      data-testid='console-container'
    >
      <div
        className='flex items-center justify-between px-2 h-10 transition-colors bg-mantle/50 border-b border-surface0/30 cursor-pointer hover:bg-surface0/10'
        onClick={onToggle}
      >
        <div className='flex items-center gap-1'>
          <TabButton
            id='console'
            label='Console'
            count={messages.length}
          />
          <TabButton
            id='problems'
            label='Problems'
            count={problemCount}
            variant={problemCount > 0 ? 'error' : 'default'}
          />
          <TabButton
            id='packages'
            label='Packages'
          />
        </div>

        <div className='flex items-center gap-3 pr-2'>
          {activeTab === 'console' && isOpen && messages.length > 0 && (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              variant='ghost'
              size='sm'
              className='h-7 px-2 text-subtext1 hover:text-red'
            >
              <Eraser
                size={14}
                className='mr-1.5'
              />
              <span className='text-xs font-bold uppercase'>Clear</span>
            </Button>
          )}
          <ChevronDown
            className={cn(
              'w-4 h-4 text-overlay0 transition-transform duration-300',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>

      {isOpen && (
        <div className='flex flex-col bg-crust flex-1 min-h-0'>
          {activeTab === 'console' && (
            <div className='flex items-center gap-2 px-3 py-1.5 bg-base/30 border-b border-surface0/20'>
              <div className='flex bg-surface0/50 rounded p-0.5 gap-0.5 shrink-0'>
                <FilterButton
                  type='all'
                  label='All'
                />
                <FilterButton
                  type='log'
                  label='Log'
                />
                <FilterButton
                  type='info'
                  label='Info'
                />
                <FilterButton
                  type='warn'
                  label='Warn'
                />
                <FilterButton
                  type='error'
                  label='Err'
                />
              </div>

              <div className='relative flex-1 max-w-xs ml-2'>
                <Search
                  size={12}
                  className='absolute left-2 top-1/2 -translate-y-1/2 text-overlay0'
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder='Filter logs...'
                  className='w-full bg-mantle border border-surface0 rounded px-7 py-0.5 text-[10px] text-text focus:outline-none focus:border-lavender'
                />
                {search && (
                  <X
                    size={10}
                    className='absolute right-2 top-1/2 -translate-y-1/2 text-overlay0 cursor-pointer hover:text-text'
                    onClick={() => setSearch('')}
                  />
                )}
              </div>

              <div className='flex items-center gap-2 ml-auto'>
                {errors > 0 && (
                  <Badge
                    label={`${errors} ERR`}
                    variant='error'
                  />
                )}
                {warns > 0 && (
                  <Badge
                    label={`${warns} WRN`}
                    variant='warn'
                  />
                )}
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            className='flex-1 overflow-y-auto p-2 font-mono text-xs selection:bg-lavender/30'
          >
            {activeTab === 'console' ? (
              filteredMessages.length === 0 ? (
                <div className='h-full flex flex-col items-center justify-center text-subtext1 opacity-40 italic'>
                  <Terminal
                    size={24}
                    className='mb-2 opacity-20'
                  />
                  {messages.length === 0 ? 'No output yet' : 'No matching logs'}
                </div>
              ) : (
                filteredMessages.map((msg, i) => {
                  const fullText = msg.args.join(' ')
                  const hasAnsi =
                    trueColorEnabled && /[\u001b\u009b]/.test(fullText)
                  return (
                    <div
                      key={`${msg.ts}-${i}`}
                      className={cn(
                        'flex items-start gap-2.5 py-1.5 px-2 border-b border-surface0/30 last:border-0 hover:bg-surface0/5 transition-colors',
                        msg.type === 'error'
                          ? 'bg-red/5'
                          : msg.type === 'warn'
                            ? 'bg-yellow/5'
                            : ''
                      )}
                    >
                      <Badge
                        label={typeLabel(msg.type)}
                        variant={typeVariant(msg.type)}
                        className='h-4 px-1 py-0 mt-0.5 min-w-[32px] justify-center'
                      />
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-2 mb-0.5 opacity-40 text-[9px] font-bold'>
                          <span>{new Date(msg.ts).toLocaleTimeString()}</span>
                        </div>
                        <div className='whitespace-pre-wrap break-all text-subtext1 leading-relaxed pl-1'>
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
                })
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
})
