import React from 'react';
import { CatppuccinTheme } from '../lib/theme';
import { Badge } from './ui/Badge';
import { PanelHeader } from './ui/PanelHeader';

export interface InstalledPackage {
  name:    string;
  version: string;
}

interface Props {
  theme:           CatppuccinTheme;
  packages:        InstalledPackage[];
  isOpen:          boolean;
  onToggle:        () => void;
  contentHeight:   number;
}

const FONT = "'Victor Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";

export const PackageManager = React.memo(function PackageManager({
  theme: t, packages, isOpen, onToggle, contentHeight,
}: Props) {
  return (
    <div style={{ borderTop: `1px solid ${t.surface0}`, background: t.mantle, flexShrink: 0 }}>

      <PanelHeader
        label="📦 Auto-Detected Packages"
        isOpen={isOpen}
        onToggle={onToggle}
        theme={t}
        left={
          packages.length > 0 ? (
            <Badge label={String(packages.length)} theme={t} />
          ) : undefined
        }
      />

      {isOpen && (
        <div style={{
          height:        contentHeight,
          overflowY:     'auto',
          overflowX:     'hidden',
          borderTop:     `1px solid ${t.surface0}`,
          padding:       '12px 14px 14px',
          display:       'flex',
          flexDirection: 'column',
          gap:           12,
          boxSizing:     'border-box',
        }}>

          {/* ── Installed packages list ── */}
          {packages.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{
                fontSize:      10,
                fontWeight:    600,
                color:         t.overlay1,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Detected Imports ({packages.length})
              </span>

              {packages.map(pkg => (
                <div
                  key={pkg.name}
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          10,
                    padding:      '8px 10px',
                    background:   t.surface0,
                    border:       `1px solid ${t.surface1}`,
                    borderRadius: 5,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: t.text, fontSize: 12, fontWeight: 600, fontFamily: FONT }}>
                        {pkg.name}
                      </span>
                      <Badge label={pkg.version} variant="info" theme={t} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: t.overlay0,
              fontSize: 12,
              fontFamily: FONT,
            }}>
              No external imports detected.
              <br /><br />
              <span style={{ opacity: 0.7, fontSize: 10 }}>
                Type <code style={{ color: t.mauve }}>import React from 'react'</code> to see it appear here automatically.
              </span>
            </div>
          )}

          {/* Footer hint */}
          <div style={{ fontSize: 10, color: t.overlay0, fontStyle: 'italic', marginTop: 'auto' }}>
            Packages are automatically detected and installed via npm in the WebContainer.
          </div>
        </div>
      )}
    </div>
  );
});
