import { type CSSProperties, forwardRef, useState } from 'react'
import { cn } from '../../utils/cn'

type InputProps = {
  style?: CSSProperties
} & React.InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ style, className, onFocus, onBlur, ...rest }, ref) => {
    const [focused, setFocused] = useState(false)

    return (
      <input
        ref={ref}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        className={cn(
          'w-full px-2.5 py-2 text-sm font-inherit rounded-md outline-none box-border transition-colors duration-150 bg-base text-text border',
          focused ? 'border-lavender' : 'border-surface1',
          className
        )}
        style={style}
        {...rest}
      />
    )
  }
)

Input.displayName = 'Input'
