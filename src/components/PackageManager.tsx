import React from 'react';
import { Badge } from './ui/Badge';
import { PanelHeader } from './ui/PanelHeader';

export type InstalledPackage = {
  name: string;
  version: string;
};

type Props = {
  packages: InstalledPackage[];
  isOpen: boolean;
  onToggle: () => void;
  contentHeight: number; // Now in rem
};

export const PackageManager = React.memo(function PackageManager({
  packages,
  isOpen,
  onToggle,
  contentHeight,
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
          className="overflow-y-auto overflow-x-hidden border-t border-surface0 p-4 flex flex-col gap-4 box-border"
          style={{ height: `${contentHeight}rem` }}
        >
          {packages.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-overlay1 uppercase tracking-wider">
                Detected Imports ({packages.length})
              </span>

              {packages.map((pkg) => (
                <div
                  key={pkg.name}
                  className="flex items-center gap-3 px-3 py-2.5 bg-surface0 border border-surface1 rounded-md"
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-text text-sm font-semibold font-mono">
                        {pkg.name}
                      </span>
                      <Badge label={pkg.version} variant="info" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-overlay0 text-sm font-mono">
              No external imports detected.
              <br />
              <br />
              <span className="opacity-70 text-xs">
                Type{' '}
                <code className="text-mauve">import React from 'react'</code> to
                see it appear here automatically.
              </span>
            </div>
          )}

          <div className="text-xs text-overlay0 italic mt-auto">
            Packages are automatically detected and installed via npm in the
            WebContainer.
          </div>
        </div>
      )}
    </div>
  );
});
