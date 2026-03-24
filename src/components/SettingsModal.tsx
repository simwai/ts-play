import { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Box, Cpu, FileJson, Layers, Monitor, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Badge } from './ui/Badge';
import { CodeEditor } from './CodeEditor';
import { webContainerService } from '../lib/webcontainer';
import { playgroundStore } from '../lib/state-manager';
import { usePlaygroundStore } from '../hooks/usePlaygroundStore';
import type { ThemeMode } from '../lib/theme';
import { DEFAULT_TSCONFIG } from '../lib/constants';

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tsConfigString: string;
  onSave: (val: string) => void;
};

export function SettingsModal({
  isOpen,
  onClose,
  tsConfigString,
  onSave,
}: SettingsModalProps) {
  const { theme, trueColor, lineWrap, packageManagerStatus } = usePlaygroundStore();
  const [temporaryTsConfig, setTemporaryTsConfig] = useState(tsConfigString);
  const [isSaving, setIsSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTemporaryTsConfig(tsConfigString);
      setConfigError(null);
    }
  }, [isOpen, tsConfigString]);

  const validateConfig = async (config: string) => {
    try {
      const result = await webContainerService.enqueue(async () => {
         const proc = await webContainerService.spawnManaged('node', ['__validate_config.cjs', config], { silent: true });
         let output = '';
         const reader = proc.output.getReader();
         try {
           while (true) {
             const { done, value } = await reader.read();
             if (done) break;
             output += value;
           }
         } finally {
           reader.releaseLock();
         }
         await proc.exit;
         return JSON.parse(output.trim()) as { valid: boolean; error?: string };
      });
      return result;
    } catch (e) {
      return { valid: false, error: (e as Error).message };
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await validateConfig(temporaryTsConfig);
    if (result.valid) {
      onSave(temporaryTsConfig);
      onClose();
    } else {
      setConfigError(result.error || 'Invalid tsconfig.json');
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    if (confirm('Reset tsconfig.json to defaults?')) {
      setTemporaryTsConfig(DEFAULT_TSCONFIG);
      setConfigError(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-crust/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-mantle border border-surface0 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface0 bg-mantle/50">
          <div className="flex items-center gap-3">
            <Cpu className="text-mauve" size={20} />
            <h2 className="text-lg font-bold tracking-tight text-text">System Settings</h2>
          </div>
          <IconButton onClick={onClose} title="Close" size="sm" variant="ghost">
            <X size={20} />
          </IconButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Editor Theme & Display */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-mauve font-semibold">
              <Monitor size={18} />
              <h3>Appearance & Display</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="theme-select" className="text-xs font-mono text-overlay1 uppercase tracking-wider">Editor Theme</label>
                <select
                  id="theme-select"
                  value={theme}
                  onChange={(e) => playgroundStore.setState({ theme: e.target.value as ThemeMode })}
                  className="w-full bg-crust border border-surface0 text-text rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-mauve transition-all"
                >
                  <option value="mocha">Catppuccin Mocha</option>
                  <option value="latte">Catppuccin Latte</option>
                  <option value="githubDark">GitHub Dark</option>
                  <option value="githubLight">GitHub Light</option>
                  <option value="monokai">Monokai</option>
                </select>
              </div>
              <div className="flex flex-col justify-end space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={trueColor}
                      onChange={(e) => playgroundStore.setState({ trueColor: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-surface0 rounded-full peer peer-checked:bg-mauve transition-colors"></div>
                    <div className="absolute left-1 w-3 h-3 bg-text rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <span className="text-sm text-overlay1 group-hover:text-text transition-colors">Enable TrueColor ANSI</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={lineWrap}
                      onChange={(e) => playgroundStore.setState({ lineWrap: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-surface0 rounded-full peer peer-checked:bg-mauve transition-colors"></div>
                    <div className="absolute left-1 w-3 h-3 bg-text rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <span className="text-sm text-overlay1 group-hover:text-text transition-colors">Soft Line Wrap</span>
                </label>
              </div>
            </div>
          </section>

          {/* TSConfig Editor */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-mauve font-semibold">
                <FileJson size={18} />
                <h3>Compiler Configuration</h3>
              </div>
              <Badge label="tsconfig.json" />
            </div>
            <div className="h-64 border border-surface0 rounded-lg overflow-hidden bg-crust relative">
              <CodeEditor
                language="json"
                value={temporaryTsConfig}
                onChange={setTemporaryTsConfig}
                fontSizeOverride={12}
                hideGutter={false}
                disableAutocomplete
                themeMode={theme}
                path="file:///tsconfig.json"
              />
              {configError && (
                <div className="absolute bottom-0 inset-x-0 bg-red/10 border-t border-red/20 p-2 flex items-center gap-2 text-xxs text-red animate-in slide-in-from-bottom-2">
                  <AlertCircle size={12} className="shrink-0" />
                  <span className="truncate">{configError}</span>
                </div>
              )}
            </div>
          </section>

          {/* Environment Info */}
          <section className="space-y-4">
             <div className="flex items-center gap-2 text-mauve font-semibold">
                <Layers size={18} />
                <h3>Environment</h3>
              </div>
              <div className="p-4 bg-crust border border-surface0 rounded-lg space-y-3">
                 <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-overlay1">Runtime</span>
                    <span className="text-mauve flex items-center gap-1.5"><Box size={12}/> WebContainer</span>
                 </div>
                 <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-overlay1">PM Status</span>
                    <span className={packageManagerStatus === 'idle' ? 'text-green' : 'text-yellow'}>
                      {packageManagerStatus.toUpperCase()}
                    </span>
                 </div>
              </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface0 bg-mantle flex items-center justify-between shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            className="text-overlay1 hover:text-red hover:bg-red/5"
          >
            <RotateCcw size={16} />
            Reset Defaults
          </Button>
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
             <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-mauve hover:bg-mauve/90 text-crust font-bold min-w-[100px]"
              >
               {isSaving ? (
                 <div className="w-4 h-4 border-2 border-crust border-t-transparent rounded-full animate-spin" />
               ) : (
                 <>
                   <Save size={16} />
                   Save Changes
                 </>
               )}
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
