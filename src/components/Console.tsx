import React, { useRef, useEffect, useMemo, useState } from 'react'
import { Eraser, X } from 'lucide-react'
import { Badge } from './ui/Badge'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'
import Ansi from 'ansi-to-html'
import { type ConsoleMessage } from '../lib/types'

type Props = {
  messages: ConsoleMessage[]
  onClear: () => void
  isOpen: boolean
  onToggle: () => void
  contentHeight: number
  showNodeWarnings?: boolean
  activeTab: 'console' | 'problems' | 'packages'
  onTabChange: (tab: 'console' | 'problems' | 'packages') => void
  problemCount: number
}

const converter = new Ansi({ newline: true, escapeXML: true })

export const Console = React.memo(function Console({
  messages,
  onClear,
  isOpen,
  onToggle,
  contentHeight,
  showNodeWarnings = true,
  activeTab,
  onTabChange,
  problemCount,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState('')

  const filteredMessages = useMemo(() => {
    const searchFilter = filter.toLowerCase()
    return messages.filter((m) => {
      if (!showNodeWarnings && m.type === 'system') return false
      if (searchFilter && !m.args.some(a => String(a).toLowerCase().includes(searchFilter))) return false
      return true
    })
  }, [messages, showNodeWarnings, filter])

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isOpen, filteredMessages])

  if (!isOpen) return null

  return (
    <div className="flex flex-col bg-crust border-t border-surface0" style={{ height: `${contentHeight}rem` }}>
      <div className="flex items-center justify-between px-3 h-9 border-b border-surface0 bg-mantle shrink-0">
        <div className="flex gap-1">
          <button onClick={() => onTabChange('console')} className={cn("px-3 py-1 text-xs rounded-md", activeTab === 'console' ? "bg-surface0 text-lavender" : "text-subtext1")}>Console</button>
          <button onClick={() => onTabChange('problems')} className={cn("px-3 py-1 text-xs rounded-md flex items-center gap-1.5", activeTab === 'problems' ? "bg-surface0 text-lavender" : "text-subtext1")}>
            Problems {problemCount > 0 && <span className="bg-red/20 text-red text-[10px] px-1.5 rounded-full">{problemCount}</span>}
          </button>
          <button onClick={() => onTabChange('packages')} className={cn("px-3 py-1 text-xs rounded-md", activeTab === 'packages' ? "bg-surface0 text-lavender" : "text-subtext1")}>Packages</button>
        </div>
        <div className="flex items-center gap-2">
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..." className="bg-crust border border-surface0 rounded px-2 py-0.5 text-xs text-text focus:outline-none focus:border-lavender" />
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 w-7 p-0" title="Clear Console"><Eraser size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 w-7 p-0"><X size={14} /></Button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 font-mono text-xs selection:bg-lavender/30">
        {filteredMessages.map((msg, i) => (
          <div key={`${msg.ts}-${i}`} className="py-1 px-2 border-b border-surface0/30 hover:bg-surface0/10 transition-colors">
            <div className="flex items-center gap-2 mb-0.5 opacity-60 text-[10px]">
              <Badge variant={msg.type === 'error' ? 'error' : msg.type === 'warn' ? 'warn' : 'info'} className="uppercase px-1 py-0 h-3.5">{msg.type}</Badge>
              <span>{new Date(msg.ts).toLocaleTimeString()}</span>
            </div>
            <div className="whitespace-pre-wrap break-all text-subtext1 leading-relaxed pl-1">
              {msg.args.map((arg, j) => <span key={j} dangerouslySetInnerHTML={{ __html: converter.toHtml(String(arg)) }} />)}
            </div>
          </div>
        ))}
        {filteredMessages.length === 0 && (
          <div className="h-full flex items-center justify-center text-subtext1 opacity-40 italic">No logs found</div>
        )}
      </div>
    </div>
  )
})
