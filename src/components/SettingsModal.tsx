import { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { workerClient } from '../lib/workerClient'
import { formatJson } from '../lib/formatter'

type SettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  tsConfigString: string
  onSave: (newConfig: string) => void
}

export function SettingsModal({
  isOpen,
  onClose,
  tsConfigString,
  onSave,
}: SettingsModalProps) {
  const [temporaryTsConfig, setTemporaryTsConfig] = useState(tsConfigString)
  const [isValid, setIsValid] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isFormatting, setIsFormatting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTemporaryTsConfig(tsConfigString)
      setIsValid(true)
      setErrorMsg(null)
    }
  }, [isOpen, tsConfigString])

  // Debounced validation via the worker
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(async () => {
      try {
        const res = await workerClient.validateConfig(temporaryTsConfig)

        if (!res.valid) {
          // Try formatting with json5 to see if it resolves the issue (e.g., unquoted keys)
          const formatted = await formatJson(temporaryTsConfig)
          if (formatted !== temporaryTsConfig) {
            const formattedRes = await workerClient.validateConfig(formatted)
            if (formattedRes.valid) {
              setIsValid(true)
              setErrorMsg(
                'Syntax will be auto-formatted on save (e.g., adding missing quotes).'
              )
              return
            }
          }
        }

        setIsValid(res.valid)
        setErrorMsg(res.error || null)
      } catch {
        setIsValid(false)
        setErrorMsg('Validation failed')
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [temporaryTsConfig, isOpen])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next =
        temporaryTsConfig.slice(0, start) + '  ' + temporaryTsConfig.slice(end)
      setTemporaryTsConfig(next)

      // Synchronously restore cursor position after React updates the DOM
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      }, 0)
    }
  }

  const handleSave = async () => {
    if (!isValid) return
    setIsFormatting(true)
    try {
      const formatted = await formatJson(temporaryTsConfig)
      onSave(formatted)
    } catch {
      onSave(temporaryTsConfig) // Fallback to raw if formatting fails
    } finally {
      setIsFormatting(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-crust/80 backdrop-blur-sm p-4'>
      <div className='bg-mantle border border-surface1 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-surface0 bg-base'>
          <h2 className='text-base font-bold text-text'>Settings</h2>
          <IconButton
            onClick={onClose}
            size='sm'
            variant='ghost'
            className='-mr-2'
          >
            <span className='text-xl leading-none'>&times;</span>
          </IconButton>
        </div>
        <div className='p-6 flex flex-col gap-5'>
          <div className='flex flex-col gap-2'>
            <label className='text-sm font-bold text-subtext0'>
              TypeScript Version
            </label>
            <select
              disabled
              className='bg-surface0 border border-surface1 rounded-md px-3 py-2 text-sm text-text outline-none opacity-60 cursor-not-allowed'
            >
              <option>5.9.3 (Default)</option>
            </select>
            <span className='text-xs text-overlay0'>
              Version switching is not yet supported.
            </span>
          </div>
          <div className='flex flex-col gap-2'>
            <label className='text-sm font-bold text-subtext0'>
              tsconfig.json
            </label>
            <textarea
              className='bg-surface0 border border-surface1 rounded-md px-3 py-2 text-sm text-text outline-none focus:border-mauve font-mono resize-y min-h-40'
              value={temporaryTsConfig}
              onChange={(e) => {
                setTemporaryTsConfig(e.target.value)
              }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
            />
            {errorMsg && (
              <span
                className={`text-xs whitespace-pre-wrap ${isValid ? 'text-yellow' : 'text-red'}`}
              >
                {errorMsg}
              </span>
            )}
          </div>
        </div>
        <div className='flex items-center justify-end gap-3 px-6 py-4 border-t border-surface0 bg-base'>
          <Button
            onClick={onClose}
            variant='ghost'
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant='primary'
            disabled={!isValid || isFormatting}
          >
            {isFormatting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
