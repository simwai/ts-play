import React, { useState, useEffect } from 'react'
import { Github, Settings } from 'lucide-react'
import { useSetAtom } from 'jotai'
import { IconButton } from './ui/IconButton'
import { Button } from './ui/Button'
import { CodeEditor } from './CodeEditor'
import { workerClient } from '../lib/workerClient'
import { formatJson } from '../lib/formatter'
import { DEFAULT_TSCONFIG } from '../lib/constants'
import {
  DARK_THEMES,
  LIGHT_THEMES,
  THEME_LABELS,
  type ThemeMode,
} from '../lib/theme'
import { enqueueTaskAtom, addToastAtom } from '../lib/store'

type SettingsModalProps = {
  isOpen: boolean
  onClose: () => void
  tsConfigString: string
  onSave: (config: string) => void
  trueColorEnabled: boolean
  setTrueColorEnabled: (val: boolean) => void
  lineWrap: boolean
  setLineWrap: (val: boolean) => void
  packageManagerStatus: string
  isDarkMode: boolean
  preferredDarkTheme: ThemeMode
  setPreferredDarkTheme: (val: ThemeMode) => void
  preferredLightTheme: ThemeMode
  setPreferredLightTheme: (val: ThemeMode) => void
}

function fixLooseJson(json: string) {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    // If it's not valid JSON, try to wrap keys in quotes (very basic)
    return json.replace(/(\w+):/g, '"$1":')
  }
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
  isDarkMode,
  preferredDarkTheme,
  setPreferredDarkTheme,
  preferredLightTheme,
  setPreferredLightTheme,
}: SettingsModalProps) {
  const [temporaryTsConfig, setTemporaryTsConfig] = useState(tsConfigString)
  const [isValid, setIsValid] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const enqueueTask = useSetAtom(enqueueTaskAtom)
  const addToast = useSetAtom(addToastAtom)

  useEffect(() => {
    setTemporaryTsConfig(tsConfigString)
  }, [tsConfigString, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(async () => {
      try {
        const res = await workerClient.validateConfig(temporaryTsConfig)
        if (res.isErr()) {
            setIsValid(false)
            setErrorMsg(res.error.message)
            return
        }
        const validation = res.value
        if (!validation.valid) {
          const fixed = fixLooseJson(temporaryTsConfig)
          if (fixed !== temporaryTsConfig) {
            const fixedRes = await workerClient.validateConfig(fixed)
            if (fixedRes.isOk() && fixedRes.value.valid) {
              setIsValid(true)
              setErrorMsg(
                'Syntax will be auto-formatted on save (e.g., adding missing quotes).'
              )
              return
            }
          }
        }
        setIsValid(validation.valid)
        setErrorMsg(validation.error || null)
      } catch {
        setIsValid(false)
        setErrorMsg('Validation failed')
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [temporaryTsConfig, isOpen])

  const handleSave = async () => {
    if (!isValid) return

    onClose()

    await enqueueTask({
      name: 'Update TSConfig',
      task: async () => {
        try {
          let toSave = temporaryTsConfig
          const valRes = await workerClient.validateConfig(toSave)
          if (valRes.isOk() && !valRes.value.valid) {
            const fixed = fixLooseJson(toSave)
            const fixedRes = await workerClient.validateConfig(fixed)
            if (fixedRes.isOk() && fixedRes.value.valid) toSave = fixed
          }
          const formatted = await formatJson(toSave)
          const finalConfig = fixLooseJson(formatted)

          onSave(finalConfig)
          addToast({ type: 'success', message: 'TSConfig updated successfully' })
        } catch (error) {
          addToast({
            type: 'error',
            message: `Failed to save TSConfig: ${(error as Error).message}`
          })
        }
      }
    })
  }

  if (!isOpen) return null

  const availableThemes = isDarkMode ? DARK_THEMES : LIGHT_THEMES
  const currentTheme = isDarkMode ? preferredDarkTheme : preferredLightTheme
  const setTheme = isDarkMode ? setPreferredDarkTheme : setPreferredLightTheme

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

        <div className='flex-1 overflow-y-auto min-h-0'>
          <div className='px-5 py-6 flex flex-col gap-6'>
            <div className='flex flex-col gap-4'>
              <div className='flex flex-col gap-2'>
                <label className='text-sm font-bold text-subtext0'>
                  Syntax Theme
                </label>
                <select
                  value={currentTheme}
                  onChange={(e) => setTheme(e.target.value as ThemeMode)}
                  className='bg-surface0 border border-surface1 rounded-md px-3 py-2 text-sm text-text outline-none focus:border-mauve transition-colors'
                >
                  {availableThemes.map((value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {THEME_LABELS[value]}
                    </option>
                  ))}
                </select>
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
                  path='file:///tsconfig.json'
                  language='json'
                  value={temporaryTsConfig}
                  onChange={setTemporaryTsConfig}
                  hideGutter={false}
                  fontSizeOverride={12}
                  lineWrap={lineWrap}
                  theme={currentTheme}
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
        </div>

        <div className='flex flex-col shrink-0'>
          <div className='flex items-center justify-between gap-3 px-5 py-3 border-t border-surface0 bg-base'>
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

          <div className='px-5 py-3 border-t border-surface0 bg-mantle flex flex-col items-center gap-2'>
            <div className='flex items-center gap-2'>
              <p className='text-xs text-subtext0'>
                Made with 💜 by
                <span className='ml-1 font-bold'>
                  simwai
                </span>
              </p>
              <a
                href='https://github.com/simwai/ts-play'
                target='_blank'
                rel='noopener noreferrer'
                className='text-subtext0 hover:text-mauve transition-colors'
                aria-label='GitHub Repository'
              >
                <Github size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
