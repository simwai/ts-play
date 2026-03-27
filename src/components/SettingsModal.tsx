import {
  AlertCircle,
  Box,
  Cpu,
  FileJson,
  Layers,
  Monitor,
  PackageCheck,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePlaygroundStore } from '../hooks/usePlaygroundStore';
import { DEFAULT_TSCONFIG } from '../lib/constants';
import { RegexPatterns, toRegExp } from '../lib/regex';
import { playgroundStore } from '../lib/state-manager';
import {
  DARK_THEMES,
  isDarkMode,
  LIGHT_THEMES,
  type ThemeMode,
} from '../lib/theme';
import { webContainerService } from '../lib/webcontainer';
import { CodeEditor } from './CodeEditor';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

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
  const { theme, stripAnsi, lineWrap, inlineDeps, packageManagerStatus } =
    usePlaygroundStore();
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
        let output = '';
        const proc = await webContainerService.spawnManaged(
          'node',
          ['__validate_config.cjs'],
          {
            silent: true,
            onLog: (line) => {
              output += line;
            },
          },
        );
        const writer = proc.input.getWriter();
        await writer.write(config);
        await writer.close();
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

  const currentIsDark = isDarkMode(theme);
  const themeOptions = currentIsDark ? DARK_THEMES : LIGHT_THEMES;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-crust/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-mantle border border-surface0 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface0 bg-mantle/50">
          <div className="flex items-center gap-3">
            <Cpu className="text-mauve" size={20} />
            <h2 className="text-lg font-bold tracking-tight text-text">
              System Settings
            </h2>
          </div>
          <IconButton onClick={onClose} title="Close" size="sm" variant="ghost">
            <X size={20} />
          </IconButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Appearance */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-mauve font-semibold">
              <Monitor size={18} />
              <h3>Appearance</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label
                  htmlFor="editor-theme"
                  className="text-xs font-mono text-overlay1 uppercase tracking-wider"
                >
                  Editor Theme
                </label>
                <select
                  id="editor-theme"
                  value={theme}
                  onChange={(e) =>
                    playgroundStore.setState({
                      theme: e.target.value as ThemeMode,
                    })
                  }
                  className="w-full bg-crust border border-surface0 text-text rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-mauve transition-all"
                >
                  {themeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() +
                        t
                          .slice(1)
                          .replace(
                            toRegExp(RegexPatterns.CAPITAL_LETTERS),
                            ' ',
                          )}
                    </option>
                  ))}
                </select>
                <p className="text-xxs text-overlay0 italic">
                  Only showing {currentIsDark ? 'dark' : 'light'} themes.
                </p>
              </div>
              <div className="flex flex-col justify-end space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      id="strip-ansi"
                      type="checkbox"
                      checked={stripAnsi}
                      onChange={(e) =>
                        playgroundStore.setState({
                          stripAnsi: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-surface0 rounded-full peer peer-checked:bg-mauve transition-colors"></div>
                    <div className="absolute left-1 w-3 h-3 bg-text rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <span className="text-sm text-overlay1 group-hover:text-text transition-colors">
                    Strip ANSI Escapes
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      id="line-wrap"
                      type="checkbox"
                      checked={lineWrap}
                      onChange={(e) =>
                        playgroundStore.setState({ lineWrap: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-surface0 rounded-full peer peer-checked:bg-mauve transition-colors"></div>
                    <div className="absolute left-1 w-3 h-3 bg-text rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <span className="text-sm text-overlay1 group-hover:text-text transition-colors">
                    Soft Line Wrap
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* Compilation & Dependencies */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-mauve font-semibold">
              <PackageCheck size={18} />
              <h3>Compilation & Bundling</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    id="inline-deps"
                    type="checkbox"
                    checked={inlineDeps}
                    onChange={(e) =>
                      playgroundStore.setState({ inlineDeps: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-surface0 rounded-full peer peer-checked:bg-mauve transition-colors"></div>
                  <div className="absolute left-1 w-3 h-3 bg-text rounded-full transition-transform peer-checked:translate-x-5"></div>
                </div>
                <div>
                  <span className="text-sm text-overlay1 group-hover:text-text transition-colors block">
                    Inline Dependencies
                  </span>
                  <span className="text-4xs text-overlay0 uppercase font-mono tracking-tighter">
                    BUNDLE node_modules into output
                  </span>
                </div>
              </label>
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
                path="tsconfig.json"
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
                <span className="text-mauve flex items-center gap-1.5">
                  <Box size={12} /> WebContainer
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-overlay1">PM Status</span>
                <span
                  className={
                    packageManagerStatus === 'idle'
                      ? 'text-green'
                      : 'text-yellow'
                  }
                >
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
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
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

        {/* Credits */}
        <div className="px-6 py-4 border-t border-surface0 bg-mantle flex flex-col items-center gap-2 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-5 bg-gradient-to-r from-mauve via-pink to-mauve animate-gradient-x pointer-events-none" />
          <p className="text-xs text-overlay1 relative z-10">
            Made with 💜 by <span className="font-bold text-mauve">simwai</span>{' '}
            feat. jules and aider
          </p>
          <a
            href="https://github.com/simwai/ts-play"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xxs text-mauve hover:underline relative z-10 opacity-70 transition-opacity hover:opacity-100"
          >
            GitHub Repository
          </a>
        </div>
      </div>
    </div>
  );
}
