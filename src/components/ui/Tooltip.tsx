import { cn } from '../../utils/cn'

type TooltipAlign = 'center' | 'right' | 'left'

type TooltipProps = {
  title: string
  align?: TooltipAlign
  show: boolean
}

export function Tooltip({ title, align = 'center', show }: TooltipProps) {
  return (
    <div
      className={cn(
        'absolute top-full mt-2 px-2.5 py-1.5 bg-crust text-text text-xs font-mono rounded-md border border-surface1 shadow-lg z-50 pointer-events-none transition-opacity duration-150',
        'w-max max-w-64 whitespace-normal font-normal',
        align === 'center' && 'left-1/2 -translate-x-1/2 text-center',
        align === 'right' && 'right-0 text-right',
        align === 'left' && 'left-0 text-left',
        show ? 'opacity-100' : 'opacity-0',
        'group-hover:opacity-100'
      )}
    >
      {title}
    </div>
  )
}
