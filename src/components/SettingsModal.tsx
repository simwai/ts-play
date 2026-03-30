import { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { workerClient } from '../lib/workerClient'
import { formatJson } from '../lib/formatter'
import { DEFAULT_TSCONFIG } from '../lib/constants'
import { CodeEditor } from './CodeEditor'
import { playgroundStore } from '../lib/state-manager'
import { operationQueue } from '../lib/webcontainer'

type SettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  tsConfigString: string
  onSave: (newConfig: string) => void
  trueColorEnabled: boolean
  setTrueColorEnabled: (val: boolean) => void
  lineWrap: boolean
  setLineWrap: (val: boolean) => void
  packageManagerStatus: string
}

function fixLooseJson(code: string): string {
  return code.replace(/([a-zA-Z_$][\w$]*)\s*:/g, (match, key, offset, str) => {
    let i = offset - 1
    while (i >= 0 && /\s/.test(str[i])) i--
    if (str[i] === '"' || str[i] === "'") return match
    return `"${key}":`
  })
}

export function SettingsModal({
  isOpen,
  onClose,
  tsConfigString,
  onSave,
  trueColorEnabled,
  setTrueColorEnabled,
  lineWrap,
  setLineWrap,
  packageManagerStatus,
}: SettingsModalProps) {
  const [temporaryTsConfig, setTemporaryTsConfig] = useState(tsConfigString)
  const [isValid, setIsValid] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setTemporaryTsConfig(tsConfigString)
      setIsValid(true)
      setErrorMsg(null)
    }
  }, [isOpen, tsConfigString])

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(async () => {
      try {
        const res = await workerClient.validateConfig(temporaryTsConfig)
        if (!res.valid) {
          const fixed = fixLooseJson(temporaryTsConfig)
          if (fixed !== temporaryTsConfig) {
            const fixedRes = await workerClient.validateConfig(fixed)
            if (fixedRes.valid) {
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

  const handleSave = async () => {
    if (!isValid) return

    // Close immediately as requested
    onClose()

    // Queue validation and save
    playgroundStore.enqueue('Update TSConfig', async () => {
      try {
        let toSave = temporaryTsConfig
        const res = await workerClient.validateConfig(toSave)
        if (!res.valid) {
          const fixed = fixLooseJson(toSave)
          const fixedRes = await workerClient.validateConfig(fixed)
          if (fixedRes.valid) toSave = fixed
        }
        const formatted = await formatJson(toSave)
        const finalConfig = fixLooseJson(formatted)

        onSave(finalConfig)
        playgroundStore.addToast('success', 'TSConfig updated successfully')
      } catch (error) {
        playgroundStore.addToast(
          'error',
          `Failed to save TSConfig: ${(error as Error).message}`
        )
      }
    })
  }

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-crust/80 backdrop-blur-sm p-4'>
      <div
        className='bg-mantle border border-surface1 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90dvh]'
        data-testid='settings-modal'
      >
        <div className='flex items-center justify-between px-5 py-3 border-b border-surface0 bg-base shrink-0'>
          <h2 className='text-base font-bold text-text'>Settings</h2>
          <IconButton
            onClick={onClose}
            size='sm'
            variant='ghost'
            className='-mr-2'
            data-testid='settings-cancel-button'
          >
            <span className='text-xl leading-none'>&times;</span>
          </IconButton>
        </div>

        <div className='px-5 py-4 flex flex-col gap-6 overflow-y-auto min-h-0'>
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-2'>
              <label className='text-sm font-bold text-subtext0'>
                TypeScript Version
              </label>
              <div className='flex gap-2 items-center'>
                <select
                  disabled
                  className='bg-surface0 border border-surface1 rounded-md px-3 py-2 text-sm text-text outline-none opacity-60 cursor-not-allowed flex-1'
                >
                  <option>5.9.3 (Default)</option>
                </select>
                <span className='text-xs text-mauve font-medium'>STABLE</span>
              </div>
              <span className='text-xs text-overlay0'>
                Version switching is not yet supported.
              </span>
            </div>

            <div className='flex items-center justify-between group'>
              <label className='text-sm font-bold text-subtext0 group-hover:text-text transition-colors'>
                Interpret ANSI Escapes
              </label>
              <input
                type='checkbox'
                checked={trueColorEnabled}
                onChange={(e) => setTrueColorEnabled(e.target.checked)}
                className='w-5 h-5 accent-mauve cursor-pointer'
                data-testid='settings-ansi-toggle'
              />
            </div>

            <div className='flex items-center justify-between group'>
              <label className='text-sm font-bold text-subtext0 group-hover:text-text transition-colors'>
                Line Wrapping
              </label>
              <input
                type='checkbox'
                checked={lineWrap}
                onChange={(e) => setLineWrap(e.target.checked)}
                className='w-5 h-5 accent-mauve cursor-pointer'
                data-testid='settings-wrap-toggle'
              />
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-sm font-bold text-subtext0'>
              tsconfig.json
            </label>
            <div className='border border-surface1 rounded-md overflow-hidden bg-base focus-within:border-mauve transition-colors h-48 md:h-64 shrink-0'>
              <CodeEditor
                path="file:///tsconfig.json"
                language='json'
                value={temporaryTsConfig}
                onChange={setTemporaryTsConfig}
                hideGutter={false}
                hideTypeInfo={true}
                fontSizeOverride={12}
                disableAutocomplete={true}
                disableDiagnostics={true}
                disableShortcuts={true}
                lineWrap={lineWrap}
              />
            </div>
            {errorMsg && (
              <div
                className={cn(
                  'px-3 py-2 rounded-md text-xs border flex gap-2',
                  isValid
                    ? 'bg-yellow/10 border-yellow/30 text-yellow'
                    : 'bg-red/10 border-red/30 text-red'
                )}
              >
                <div className='shrink-0 font-bold'>
                  {isValid ? '⚠️' : '❌'}
                </div>
                <span className='whitespace-pre-wrap'>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>

        <div className='flex items-center justify-between gap-3 px-5 py-3 border-t border-surface0 bg-base shrink-0'>
          <Button
            onClick={() => setTemporaryTsConfig(DEFAULT_TSCONFIG)}
            variant='danger'
            size='sm'
            className='text-red hover:bg-red/10'
          >
            Reset to Default
          </Button>
          <div className='flex gap-3'>
            <Button
              onClick={onClose}
              variant='secondary'
              size='sm'
              data-testid='settings-cancel-button'
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant='primary'
              size='sm'
              disabled={!isValid}
              data-testid='settings-save-button'
            >
              Save Changes
            </Button>
          </div>
        </div>

        <div className='px-5 py-2 border-t border-surface0 bg-mantle flex flex-col items-center gap-1 shrink-0'>
          <p className='text-xs text-subtext0 text-center'>
            Made with 💜 by
            <br />
            <span className='font-graffonti text-xl bg-lit-gradient animate-lit-gradient leading-relaxed'>
              simwai
            </span>
            <br />
            <span className='opacity-50 text-[10px] uppercase tracking-widest'>
              feat. jules & aider
            </span>
          </p>
          <a
            href='https://github.com/simwai/ts-play'
            target='_blank'
            rel='noopener noreferrer'
            className='text-xs text-mauve hover:underline'
          >
            GitHub Repository
          </a>
        </div>
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
