import {
  Sun,
  Moon,
  Copy,
  Check,
  Trash2,
  Wand2,
  Loader2,
  Play,
  Square,
  Share2,
} from 'lucide-react';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import {
  type ThemeMode,
  DARK_THEMES,
  LIGHT_THEMES,
  isDarkMode,
} from '../lib/theme';
import { TABS, type TabType } from '../lib/constants';

type HeaderProps = {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode | ((m: ThemeMode) => ThemeMode)) => void;
  handleCopyAll: () => void;
  copied: boolean;
  handleDeleteAll: () => void;
  handleFormat: () => void;
  formatting: boolean;
  formatSuccess: boolean;
  doRun: (skipDirtyCheck?: boolean) => void;
  isRunning: boolean;
  compilerStatus: 'loading' | 'ready' | 'error';
  handleShare: () => void;
  sharing: boolean;
  shareSuccess: boolean;
  stopCode?: () => void;
};

export function Header({
  activeTab,
  setActiveTab,
  themeMode,
  setThemeMode,
  handleCopyAll,
  copied,
  handleDeleteAll,
  handleFormat,
  formatting,
  formatSuccess,
  doRun,
  isRunning,
  compilerStatus,
  handleShare,
  sharing,
  shareSuccess,
  stopCode,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-1.5 md:px-3 h-10 md:h-14 bg-mantle border-b border-surface0 shrink-0 gap-1.5 md:gap-3 relative z-40">
      {/* Brand */}
      <div className="flex items-center gap-1.5 md:gap-2 px-1">
        <span className="text-lg md:text-xl font-black tracking-tighter font-mono bg-gradient-to-r from-mauve to-peach bg-clip-text text-transparent drop-shadow-sm select-none">
          TS<span className="text-text/90">Play</span>
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface0 rounded-md p-0.5 gap-0.5 shrink">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
            }}
            className={`px-1.5 py-0.5 md:px-3 md:py-1.5 rounded border-none text-4xs md:text-xs font-semibold font-mono cursor-pointer tracking-wide uppercase transition-all duration-150 ${
              activeTab === tab
                ? 'bg-mauve/15 text-mauve shadow-sm ring-1 ring-mauve/30'
                : 'bg-transparent text-overlay1 hover:text-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {/* Theme toggle */}
        <IconButton
          onClick={() => {
            setThemeMode((m) => {
              const currentIsDark = isDarkMode(m);
              const oppositeThemes = currentIsDark ? LIGHT_THEMES : DARK_THEMES;
              return oppositeThemes[0];
            });
          }}
          title={
            isDarkMode(themeMode)
              ? 'Switch to Light Mode'
              : 'Switch to Dark Mode'
          }
          tooltipAlign="right"
          variant="surface"
          size="sm"
        >
          {isDarkMode(themeMode) ? (
            <Sun className="w-3 h-3 md:w-4 md:h-4" />
          ) : (
            <Moon className="w-3 h-3 md:w-4 md:h-4" />
          )}
        </IconButton>

        {/* Separator */}
        <div className="w-px h-3.5 md:h-5 bg-surface1 shrink-0 mx-0.5 md:mx-1" />

        {/* Copy all */}
        <IconButton
          onClick={handleCopyAll}
          title={`Copy all ${activeTab}`}
          tooltipAlign="right"
          variant="surface"
          size="sm"
          className={
            copied
              ? 'text-green border-green bg-green/15 hover:bg-green/20'
              : ''
          }
        >
          {copied ? (
            <Check className="w-3 h-3 md:w-4 md:h-4" />
          ) : (
            <Copy className="w-3 h-3 md:w-4 md:h-4" />
          )}
        </IconButton>

        {/* Delete all */}
        <IconButton
          onClick={handleDeleteAll}
          title={`Clear ${activeTab} editor`}
          tooltipAlign="right"
          variant="surface"
          size="sm"
          className="text-red hover:text-red"
        >
          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
        </IconButton>

        {/* Format */}
        <IconButton
          onClick={handleFormat}
          disabled={formatting}
          title="Format all files with Prettier (TS + JS + DTS)"
          tooltipAlign="right"
          variant="surface"
          size="sm"
          className={
            formatSuccess
              ? 'text-green border-green bg-green/15 hover:bg-green/20'
              : ''
          }
        >
          {formatting ? (
            <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
          ) : formatSuccess ? (
            <Check className="w-3 h-3 md:w-4 md:h-4" />
          ) : (
            <Wand2 className="w-3 h-3 md:w-4 md:h-4" />
          )}
        </IconButton>

        {/* Separator */}
        <div className="w-px h-3.5 md:h-5 bg-surface1 shrink-0 mx-0.5 md:mx-1" />

        {/* Run / Stop */}
        {isRunning ? (
          <Button
            onClick={() => stopCode?.()}
            data-testid="header-stop-button"
            variant="primary"
            size="sm"
            title="Stop execution"
            tooltipAlign="right"
            className="font-mono tracking-wide bg-red! border-red! hover:bg-red/80 active:bg-red/90"
          >
            <Square className="w-3 h-3 md:w-4 md:h-4" fill="currentColor" />
            <span className="hidden sm:inline">Stop</span>
          </Button>
        ) : (
          <Button
            onClick={async () => doRun(false)}
            data-testid="header-run-button"
            disabled={compilerStatus !== 'ready'}
            variant="primary"
            size="sm"
            title="Run (compile + execute)"
            tooltipAlign="right"
            className="font-mono tracking-wide"
          >
            <Play className="w-3 h-3 md:w-4 md:h-4" fill="currentColor" />
            <span className="hidden sm:inline">Run</span>
          </Button>
        )}

        {/* Separator */}
        <div className="w-px h-3.5 md:h-5 bg-surface1 shrink-0 mx-0.5 md:mx-1" />

        {/* Share */}
        <IconButton
          onClick={handleShare}
          title={sharing ? 'Sharing...' : 'Share snippet (expires in 7 days)'}
          tooltipAlign="right"
          variant="surface"
          size="sm"
          disabled={sharing}
          className={
            shareSuccess
              ? 'text-green border-green bg-green/15 hover:bg-green/20'
              : ''
          }
        >
          {sharing ? (
            <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
          ) : shareSuccess ? (
            <Check className="w-3 h-3 md:w-4 md:h-4" />
          ) : (
            <Share2 className="w-3 h-3 md:w-4 md:h-4" />
          )}
        </IconButton>
      </div>
    </header>
  );
}
