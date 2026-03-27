import {
  Check,
  Copy,
  Loader2,
  Moon,
  Play,
  Share2,
  Square,
  Sun,
  Trash2,
  Wand2,
} from 'lucide-react';
import { TABS, type TabType } from '../lib/constants';
import {
  DARK_THEMES,
  isDarkMode,
  LIGHT_THEMES,
  type ThemeMode,
} from '../lib/theme';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

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
    <header className="flex items-center justify-between px-1 md:px-2 h-9 md:h-11 bg-mantle border-b border-surface0 shrink-0 gap-1 md:gap-2 relative z-40">
      {/* Brand */}
      <div className="flex items-center gap-1 md:gap-1.5 px-0.5">
        <span className="text-base md:text-lg font-black tracking-tighter font-mono bg-gradient-to-r from-mauve to-peach bg-clip-text text-transparent drop-shadow-sm select-none">
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
            className={`px-1 py-0.5 md:px-2 md:py-1 rounded border-none text-[10px] md:text-xs font-semibold font-mono cursor-pointer tracking-wide uppercase transition-all duration-150 ${
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
      <div className="flex items-center gap-0.5 md:gap-1.5 shrink-0">
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
          className="w-7 h-7 md:w-8 md:h-8"
        >
          {isDarkMode(themeMode) ? (
            <Sun className="w-3.5 h-3.5 md:w-4 md:h-4" />
          ) : (
            <Moon className="w-3.5 h-3.5 md:w-4 md:h-4" />
          )}
        </IconButton>

        {/* Separator */}
        <div className="w-px h-3 md:h-4 bg-surface1 shrink-0 mx-0.5" />

        {/* Copy all */}
        <IconButton
          onClick={handleCopyAll}
          title={`Copy all ${activeTab}`}
          tooltipAlign="right"
          variant="surface"
          size="sm"
          className={`w-7 h-7 md:w-8 md:h-8 ${
            copied
              ? 'text-green border-green bg-green/15 hover:bg-green/20'
              : ''
          }`}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
          ) : (
            <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />
          )}
        </IconButton>

        {/* Delete all */}
        <IconButton
          onClick={handleDeleteAll}
          title={`Clear ${activeTab} editor`}
          tooltipAlign="right"
          variant="surface"
          size="sm"
          className="w-7 h-7 md:w-8 md:h-8 text-red hover:text-red"
        >
          <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </IconButton>

        {/* Format */}
        <IconButton
          onClick={handleFormat}
          disabled={formatting}
          title="Format all files with Prettier (TS + JS + DTS)"
          tooltipAlign="right"
          variant="surface"
          size="sm"
          className={`w-7 h-7 md:w-8 md:h-8 ${
            formatSuccess
              ? 'text-green border-green bg-green/15 hover:bg-green/20'
              : ''
          }`}
        >
          {formatting ? (
            <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
          ) : formatSuccess ? (
            <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
          ) : (
            <Wand2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          )}
        </IconButton>

        {/* Separator */}
        <div className="w-px h-3 md:h-4 bg-surface1 shrink-0 mx-0.5" />

        {/* Run / Stop */}
        {isRunning ? (
          <Button
            onClick={() => stopCode?.()}
            data-testid="header-stop-button"
            variant="primary"
            size="sm"
            title="Stop execution"
            tooltipAlign="right"
            className="h-7 md:h-8 px-2 md:px-3 font-mono tracking-wide bg-red! border-red! hover:bg-red/80 active:bg-red/90 text-xs"
          >
            <Square className="w-3.5 h-3.5 md:w-4 md:h-4" fill="currentColor" />
            <span className="hidden sm:inline ml-1">Stop</span>
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
            className="h-7 md:h-8 px-2 md:px-3 font-mono tracking-wide text-xs"
          >
            <Play className="w-3.5 h-3.5 md:w-4 md:h-4" fill="currentColor" />
            <span className="hidden sm:inline ml-1">Run</span>
          </Button>
        )}

        {/* Separator */}
        <div className="w-px h-3 md:h-4 bg-surface1 shrink-0 mx-0.5" />

        {/* Share */}
        <IconButton
          onClick={handleShare}
          title={sharing ? 'Sharing...' : 'Share snippet (expires in 7 days)'}
          tooltipAlign="right"
          variant="surface"
          size="sm"
          disabled={sharing}
          className={`w-7 h-7 md:w-8 md:h-8 ${
            shareSuccess
              ? 'text-green border-green bg-green/15 hover:bg-green/20'
              : ''
          }`}
        >
          {sharing ? (
            <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
          ) : shareSuccess ? (
            <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
          ) : (
            <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          )}
        </IconButton>
      </div>
    </header>
  );
}
