import React from 'react'

interface TypeInfoBarProps {
  typeInfo: string | null
  line: number
  column: number
  visible: boolean
}

export const TypeInfoBar: React.FC<TypeInfoBarProps> = React.memo(({ typeInfo, line, column, visible }) => {
  if (!visible) return null

  return (
    <div
      className="h-6 flex items-center px-3 bg-mantle border-t border-surface0 text-xxs text-subtext1 font-mono overflow-hidden whitespace-nowrap shrink-0"
      data-testid="type-info-bar"
    >
      <div className="flex-1 truncate">
        {typeInfo || 'Ready'}
      </div>
      <div className="ml-4 opacity-70 shrink-0">
        Ln {line}, Col {column}
      </div>
    </div>
  )
})

TypeInfoBar.displayName = 'TypeInfoBar'
