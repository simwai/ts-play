import { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { workerClient } from '../lib/workerClient'
import { formatJson } from '../lib/formatter'
import { DEFAULT_TSCONFIG } from '../lib/constants'
import { CodeEditor } from './CodeEditor'

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
  themeMode: string
  setThemeMode: (mode: any) => void
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
  themeMode,
  setThemeMode,
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
    setIsFormatting(true)
    try {
      let toSave = temporaryTsConfig
      const res = await workerClient.validateConfig(toSave)
      if (!res.valid) {
        const fixed = fixLooseJson(toSave)
        const fixedRes = await workerClient.validateConfig(fixed)
        if (fixedRes.valid) toSave = fixed
      }
      const formatted = await formatJson(toSave)
      onSave(fixLooseJson(formatted))
    } catch {
      onSave(fixLooseJson(temporaryTsConfig))
    } finally {
      setIsFormatting(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-crust/80 backdrop-blur-sm p-4'>
      <div
        className='bg-mantle border border-surface1 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90dvh]'
        data-testid='settings-modal'
      >
        <div className='flex items-center justify-between px-6 py-4 border-b border-surface0 bg-base shrink-0'>
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

        <div className='p-6 flex flex-col gap-6 overflow-y-auto min-h-0'>
          <div className='flex flex-col gap-4'>
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

            <div className='flex items-center justify-between'>
              <label className='text-sm font-bold text-subtext0'>
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

            <div className='flex items-center justify-between'>
              <label className='text-sm font-bold text-subtext0'>
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

            <div className='flex flex-col gap-2'>
              <label className='text-sm font-bold text-subtext0'>
                Editor Theme
              </label>
              <select
                value={themeMode}
                onChange={(e) => setThemeMode(e.target.value)}
                className='bg-surface0 border border-surface1 rounded-md px-3 py-2 text-sm text-text outline-none focus:border-mauve transition-colors'
              >
                <option value='mocha'>Catppuccin Mocha</option>
                <option value='latte'>Catppuccin Latte</option>
                <option value='githubDark'>GitHub Dark</option>
                <option value='githubLight'>GitHub Light</option>
                <option value='monokai'>Monokai</option>
              </select>
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-sm font-bold text-subtext0'>
              tsconfig.json
            </label>
            <div className='border border-surface1 rounded-md overflow-hidden bg-base focus-within:border-mauve transition-colors h-48 md:h-64 shrink-0'>
              <CodeEditor
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
                themeMode={themeMode}
              />
            </div>
            {errorMsg && (
              <span
                className={`text-xs whitespace-pre-wrap ${isValid ? 'text-yellow' : 'text-red'}`}
              >
                {errorMsg}
              </span>
            )}
          </div>
        </div>

        <div className='flex flex-col gap-3 px-6 py-4 border-t border-surface0 bg-base shrink-0 items-center'>
          <div className='flex gap-3 w-full justify-center'>
            <Button
              onClick={onClose}
              variant='secondary'
              data-testid='settings-cancel-button'
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant='primary'
              disabled={!isValid || isFormatting}
              data-testid='settings-save-button'
            >
              {isFormatting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
          <Button
            onClick={() => setTemporaryTsConfig(DEFAULT_TSCONFIG)}
            variant='danger'
            size='sm'
            className='text-red hover:bg-red/10'
          >
            Reset to Default tsconfig
          </Button>
        </div>

        <div className='px-6 py-4 border-t border-surface0 bg-mantle flex flex-col items-center gap-2 shrink-0'>
          <p className='text-xs text-subtext0 text-center'>
            Made with 💜 by
            <br />
            <span className='font-graffonti text-2xl bg-lit-gradient animate-lit-gradient leading-relaxed'>
              simwai
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
