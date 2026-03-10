import React from 'react';
import { Badge } from './ui/Badge';
import { PanelHeader } from './ui/PanelHeader';

export interface InstalledPackage {
  name:    string;
  version: string;
}

interface Props {
  packages:        InstalledPackage[];
  isOpen:          boolean;
  onToggle:        () => void;
  contentHeight:   number;
}

const FONT = "'Victor Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";

export const PackageManager = React.memo(function PackageManager({
  packages, isOpen, onToggle, contentHeight,
}: Props) {
  return (
    <div className="border-t border-surface0 bg-mantle shrink-0">
      <PanelHeader
        label="📦 Auto-Detected Packages"
        isOpen={isOpen}
        onToggle={onToggle}
        left={
          packages.length > 0 ? (
            <Badge label={String(packages.length)} />
          ) : undefined
        }
      />

      {isOpen && (
        <div 
          className="overflow-y-auto overflow-x-hidden border-t border-surface0 p-3 flex flex-col gap-3 box-border"
          style={{ height: contentHeight }}
        >
          {packages.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-overlay1 uppercase tracking-[0.06em]">
                Detected Imports ({packages.length})
              </span>

              {packages.map(pkg => (
                <div
                  key={pkg.name}
                  className="flex items-center gap-2.5 px-2.5 py-2 bg-surface0 border border-surface1 rounded-[5px]"
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-text text-xs font-semibold" style={{ fontFamily: FONT }}>
                        {pkg.name}
                      </span>
                      <Badge label={pkg.version} variant="info" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 text-center text-overlay0 text-xs" style={{ fontFamily: FONT }}>
              No external imports detected.
              <br /><br />
              <span className="opacity-70 text-[10px]">
                Type <code className="text-mauve">import React from 'react'</code> to see it appear here automatically.
              </span>
            </div>
          )}

          <div className="text-[10px] text-overlay0 italic mt-auto">
            Packages are automatically detected and installed via npm in the WebContainer.
          </div>
        </div>
      )}
    </div>
  );
});
