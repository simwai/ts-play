import { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'

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

  useEffect(() => {
    if (isOpen) {
      setTemporaryTsConfig(tsConfigString)
    }
  }, [isOpen, tsConfigString])

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
            <select className='bg-surface0 border border-surface1 rounded-md px-3 py-2 text-sm text-text outline-none focus:border-mauve'>
              <option>5.9.3 (Default)</option>
              <option>5.8.2</option>
              <option>5.7.3</option>
            </select>
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
              spellCheck={false}
            />
            {(() => {
              try {
                JSON.parse(temporaryTsConfig)
                return null
              } catch {
                return (
                  <span className='text-xs text-red'>
                    Invalid JSON. Fallback config will be used.
                  </span>
                )
              }
            })()}
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
            onClick={() => {
              onSave(temporaryTsConfig)
              onClose()
            }}
            variant='primary'
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
