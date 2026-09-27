import type { CompilerStatus } from '../lib/types'
import { TABS, type TabType } from '../lib/constants'

type HeaderProps = {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
}

export function Header({ activeTab, setActiveTab }: HeaderProps) {
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
              setActiveTab(tab)
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
    </header>
  )
}
