import { useState, useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { X, Check, AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '../lib/utils'
import { CodeEditor } from './CodeEditor'
import {
  tsConfigAtom,
  isDarkModeAtom,
  preferredDarkThemeAtom,
  preferredLightThemeAtom,
  lineWrapAtom,
  trueColorEnabledAtom,
  resetWorkspaceAtom,
  autoImportsAtom,
} from '../lib/store'
import { DARK_THEMES, LIGHT_THEMES, THEME_LABELS } from '../lib/theme'
import { workerClient } from '../lib/workerClient'
import { Badge } from './ui/Badge'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: Props) {
  const [tsConfig, setTsConfig] = useAtom(tsConfigAtom)
  const [isDarkMode] = useAtom(isDarkModeAtom)
  const [preferredDark, setPreferredDark] = useAtom(preferredDarkThemeAtom)
  const [preferredLight, setPreferredLight] = useAtom(preferredLightThemeAtom)
  const [lineWrap, setLineWrap] = useAtom(lineWrapAtom)
  const [trueColor, setTrueColor] = useAtom(trueColorEnabledAtom)
  const [autoImports, setAutoImports] = useAtom(autoImportsAtom)
  const resetWorkspace = useSetAtom(resetWorkspaceAtom)

  const [tempConfig, setTempConfig] = useState(tsConfig)
  const [isValid, setIsValid] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) setTempConfig(tsConfig)
  }, [isOpen, tsConfig])

  useEffect(() => {
    const validate = async () => {
      const res = await workerClient.validateConfig(tempConfig)
      res.match(
        (val: any) => {
          setIsValid(val.valid)
          setErrorMsg(val.error || null)
        },
        () => {
          setIsValid(false)
          setErrorMsg('Validation failed')
        }
      )
    }
    const timer = setTimeout(validate, 500)
    return () => clearTimeout(timer)
  }, [tempConfig])

  if (!isOpen) return null

  const handleSave = () => {
    if (isValid) {
      setTsConfig(tempConfig)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-crust/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div className="bg-mantle border border-surface0 rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface0">
          <h2 className="text-xl font-bold text-text">Playground Settings</h2>
          <button onClick={onClose} className="text-subtext1 hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section>
            <h3 className="text-sm font-bold text-lavender uppercase tracking-wider mb-4">Appearance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-subtext0">Dark Theme</label>
                <select
                  value={preferredDark}
                  onChange={(e) => setPreferredDark(e.target.value as any)}
                  className="w-full bg-crust border border-surface0 rounded-lg px-3 py-2 text-sm text-text"
                >
                  {DARK_THEMES.map(t => <option key={t} value={t}>{THEME_LABELS[t] || t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-subtext0">Light Theme</label>
                <select
                  value={preferredLight}
                  onChange={(e) => setPreferredLight(e.target.value as any)}
                  className="w-full bg-crust border border-surface0 rounded-lg px-3 py-2 text-sm text-text"
                >
                  {LIGHT_THEMES.map(t => <option key={t} value={t}>{THEME_LABELS[t] || t}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-lavender uppercase tracking-wider">Compiler Options</h3>
              {!isValid && (
                <Badge variant="error" className="animate-pulse">
                  <AlertCircle size={10} className="mr-1" /> Invalid JSON
                </Badge>
              )}
            </div>
            <div className="h-64 border border-surface0 rounded-lg overflow-hidden relative">
              <CodeEditor
                path="file:///tsconfig.json"
                language="json"
                value={tempConfig}
                onChange={setTempConfig}
                theme={isDarkMode ? 'dark' : 'light'}
                fontSizeOverride={12}
                hideTypeInfo
                hideGutter
              />
            </div>
            {errorMsg && <p className="mt-2 text-xs text-red opacity-80 font-mono">{errorMsg}</p>}
          </section>

          <section>
            <h3 className="text-sm font-bold text-lavender uppercase tracking-wider mb-4">Editor Features</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setLineWrap(!lineWrap)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  lineWrap ? "bg-lavender/5 border-lavender/30 text-lavender" : "bg-crust border-surface0 text-subtext1"
                )}
              >
                <span className="text-sm font-medium">Word Wrap</span>
                {lineWrap && <Check size={16} />}
              </button>
              <button
                onClick={() => setTrueColor(!trueColor)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  trueColor ? "bg-lavender/5 border-lavender/30 text-lavender" : "bg-crust border-surface0 text-subtext1"
                )}
              >
                <span className="text-sm font-medium">True Color Logs</span>
                {trueColor && <Check size={16} />}
              </button>
              <button
                onClick={() => setAutoImports(!autoImports)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  autoImports ? "bg-lavender/5 border-lavender/30 text-lavender" : "bg-crust border-surface0 text-subtext1"
                )}
              >
                <span className="text-sm font-medium">Auto Imports</span>
                {autoImports && <Check size={16} />}
              </button>
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-surface0 bg-mantle flex items-center justify-between">
          <button
            onClick={() => { if (confirm('Reset all settings to default?')) resetWorkspace() }}
            className="flex items-center gap-2 text-xs font-medium text-subtext0 hover:text-red transition-colors"
          >
            <RotateCcw size={14} /> Reset Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-subtext1 hover:text-text"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="px-6 py-2 bg-lavender text-crust font-bold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
