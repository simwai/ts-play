import { useState, useCallback, useRef, useEffect } from 'react';
import { CatppuccinTheme } from '../lib/theme';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { PanelHeader } from './ui/PanelHeader';

export type CdnProvider = 'esm.sh' | 'unpkg' | 'jsdelivr';

export interface InstalledPackage {
  name:    string;
  version: string;
  cdn:     CdnProvider;
  url:     string;
}

interface Props {
  theme:           CatppuccinTheme;
  packages:        InstalledPackage[];
  onAddPackage:    (pkg: InstalledPackage) => void;
  onRemovePackage: (name: string) => void;
  isOpen:          boolean;
  onToggle:        () => void;
  contentHeight:   number;
}

interface SearchResult {
  name:        string;
  version:     string;
  description: string;
}

function cdnUrl(name: string, version: string, cdn: CdnProvider): string {
  const v = version || 'latest';
  switch (cdn) {
    case 'esm.sh':   return `https://esm.sh/${name}@${v}`;
    case 'unpkg':    return `https://unpkg.com/${name}@${v}?module`;
    case 'jsdelivr': return `https://cdn.jsdelivr.net/npm/${name}@${v}/+esm`;
  }
}

async function searchNpm(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  try {
    const r = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=7`
    );
    if (!r.ok) return [];
    const d = await r.json();
    return d.objects.map((o: { package: { name: string; version: string; description?: string } }) => ({
      name:        o.package.name,
      version:     o.package.version,
      description: o.package.description ?? '',
    }));
  } catch {
    return [];
  }
}

const FONT = "'JetBrains Mono','Fira Code','Cascadia Code',monospace";

export function PackageManager({
  theme: t, packages, onAddPackage, onRemovePackage, isOpen, onToggle, contentHeight,
}: Props) {
  const [search,      setSearch]      = useState('');
  const [results,     setResults]     = useState<SearchResult[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [selected,    setSelected]    = useState<SearchResult | null>(null);
  const [version,     setVersion]     = useState('');
  const [cdn,         setCdn]         = useState<CdnProvider>('esm.sh');
  const [error,       setError]       = useState('');
  const [dropVisible, setDropVisible] = useState(false);

  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropVisible(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 60);
  }, [isOpen]);

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setSelected(null);
    setError('');
    setDropVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!v.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const res = await searchNpm(v);
      setResults(res);
      setLoading(false);
      setDropVisible(true);
    }, 300);
  }, []);

  const handleSelect = useCallback((pkg: SearchResult) => {
    setSelected(pkg);
    setVersion(pkg.version);
    setSearch(pkg.name);
    setResults([]);
    setDropVisible(false);
    setError('');
  }, []);

  const handleAdd = useCallback(() => {
    if (!selected) { setError('Select a package from the search results first'); return; }
    if (packages.some(p => p.name === selected.name)) { setError('Already installed'); return; }
    const v = version.trim() || selected.version;
    onAddPackage({ name: selected.name, version: v, cdn, url: cdnUrl(selected.name, v, cdn) });
    setSearch(''); setSelected(null); setVersion(''); setResults([]); setError('');
  }, [selected, version, cdn, packages, onAddPackage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setDropVisible(false); setResults([]); }
    if (e.key === 'Enter' && selected) handleAdd();
  }, [selected, handleAdd]);

  const selectStyle: React.CSSProperties = {
    padding:      '8px 10px',
    fontSize:     13,
    fontFamily:   'inherit',
    background:   t.base,
    border:       `1px solid ${t.surface1}`,
    borderRadius: 5,
    color:        t.text,
    outline:      'none',
    cursor:       'pointer',
    appearance:   'auto' as const,
    flex:         '1 1 90px',
    boxSizing:    'border-box' as const,
  };

  return (
    <div style={{ borderTop: `1px solid ${t.surface0}`, background: t.mantle, flexShrink: 0 }}>

      <PanelHeader
        label="📦 Packages"
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

          {/* ── Search section ── */}
          <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Search input + dropdown */}
            <div style={{ position: 'relative' }}>
              <Input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => results.length > 0 && setDropVisible(true)}
                placeholder="Search npm packages…"
                theme={t}
                autoComplete="off"
                spellCheck={false}
              />

              {/* Spinner */}
              {loading && (
                <span style={{
                  position:  'absolute',
                  right:     10,
                  top:       '50%',
                  transform: 'translateY(-50%)',
                  color:     t.overlay0,
                  fontSize:  14,
                  animation: 'spin 1s linear infinite',
                  lineHeight: 1,
                }}>⟳</span>
              )}

              {/* Dropdown results */}
              {dropVisible && results.length > 0 && (
                <div style={{
                  position:     'absolute',
                  top:          'calc(100% + 4px)',
                  left:         0,
                  right:        0,
                  background:   t.surface0,
                  border:       `1px solid ${t.surface1}`,
                  borderRadius: 6,
                  overflowY:    'auto',
                  maxHeight:    220,
                  zIndex:       200,
                  boxShadow:    `0 8px 24px ${t.crust}88`,
                }}>
                  {results.map(pkg => (
                    <button
                      key={pkg.name}
                      onMouseDown={e => { e.preventDefault(); handleSelect(pkg); }}
                      style={{
                        width:         '100%',
                        padding:       '9px 12px',
                        background:    'transparent',
                        border:        'none',
                        borderBottom:  `1px solid ${t.surface1}44`,
                        textAlign:     'left',
                        cursor:        'pointer',
                        display:       'flex',
                        flexDirection: 'column',
                        gap:           2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: t.text, fontWeight: 600, fontSize: 12, fontFamily: FONT }}>
                          {pkg.name}
                        </span>
                        <span style={{ color: t.overlay1, fontSize: 10, fontFamily: FONT }}>
                          @{pkg.version}
                        </span>
                      </div>
                      {pkg.description && (
                        <span style={{
                          color:        t.overlay0,
                          fontSize:     11,
                          overflow:     'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace:   'nowrap',
                        }}>
                          {pkg.description.length > 72
                            ? pkg.description.slice(0, 72) + '…'
                            : pkg.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Version + CDN + Add row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Input
                type="text"
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="Version"
                theme={t}
                style={{ width: 90, flex: 'none' }}
              />

              <select
                value={cdn}
                onChange={e => setCdn(e.target.value as CdnProvider)}
                style={selectStyle}
              >
                <option value="esm.sh">esm.sh</option>
                <option value="unpkg">unpkg</option>
                <option value="jsdelivr">jsdelivr</option>
              </select>

              <Button
                onClick={handleAdd}
                disabled={!selected}
                variant="primary"
                theme={t}
                style={{ flex: '1 1 70px', justifyContent: 'center', fontFamily: FONT }}
              >
                + Add
              </Button>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                padding:      '6px 10px',
                fontSize:     11,
                color:        t.red,
                background:   `${t.red}15`,
                border:       `1px solid ${t.red}30`,
                borderRadius: 4,
              }}>
                {error}
              </div>
            )}

            {/* URL preview */}
            {selected && (
              <div style={{
                padding:      '6px 10px',
                fontSize:     10,
                color:        t.overlay1,
                background:   t.surface0,
                borderRadius: 4,
                fontFamily:   FONT,
                wordBreak:    'break-all',
              }}>
                {cdnUrl(selected.name, version || selected.version, cdn)}
              </div>
            )}
          </div>

          {/* ── Installed packages list ── */}
          {packages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{
                fontSize:      10,
                fontWeight:    600,
                color:         t.overlay1,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Installed ({packages.length})
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
                      <span style={{ color: t.overlay1, fontSize: 10, fontFamily: FONT }}>
                        @{pkg.version}
                      </span>
                      <Badge label={pkg.cdn} variant="info" theme={t} />
                    </div>
                    <span style={{
                      color:        t.overlay0,
                      fontSize:     9,
                      fontFamily:   FONT,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}>
                      {pkg.url}
                    </span>
                  </div>

                  <Button
                    onClick={() => onRemovePackage(pkg.name)}
                    variant="danger"
                    theme={t}
                    title="Remove package"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Footer hint */}
          <div style={{ fontSize: 10, color: t.overlay0, fontStyle: 'italic', marginTop: 'auto' }}>
            Auto-imported as a smart alias:{' '}
            <code style={{ color: t.mauve, fontFamily: FONT }}>const name = mod.default ?? mod</code>
          </div>
        </div>
      )}
    </div>
  );
}
