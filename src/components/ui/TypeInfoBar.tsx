import React, { useEffect, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useMonaco } from '@monaco-editor/react';
import { RegexPatterns, toRegExp } from '../../lib/regex';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type TypeInfo = {
  name: string;
  kind: string;
  typeAnnotation: string;
  jsDoc?: string;
  signature?: string;
};

type TypeInfoBarProps = {
  typeInfo: TypeInfo | null;
  language: 'typescript' | 'javascript';
  themeMode?: string;
};

function renderWithLinksAndHighlight(text: string) {
  const regex = toRegExp(RegexPatterns.MARKDOWN_LINKS_OR_CODE);
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const mdMatch = toRegExp(RegexPatterns.MARKDOWN_LINK).exec(part);
    if (mdMatch) {
      return (
        <a
          key={i}
          href={mdMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-mauve underline underline-offset-2 hover:text-pink transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {mdMatch[1]}
        </a>
      );
    }

    const urlMatch = toRegExp(RegexPatterns.URL).exec(part);
    if (urlMatch) {
      return (
        <a
          key={i}
          href={urlMatch[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-mauve underline underline-offset-2 hover:text-pink transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {urlMatch[1]}
        </a>
      );
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="bg-surface0 px-1 rounded-sm text-mauve">
          {part.slice(1, -1)}
        </code>
      );
    }

    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export function TypeInfoBar({
  typeInfo,
  language,
  themeMode = 'mocha',
}: TypeInfoBarProps) {
  const monaco = useMonaco();
  const [highlightedType, setHighlightedType] = useState('');
  const [highlightedSig, setHighlightedSig] = useState('');

  useEffect(() => {
    if (!monaco || !typeInfo) {
      setHighlightedType('');
      setHighlightedSig('');
      return;
    }

    const colorize = async () => {
      const typeHtml = await monaco.editor.colorize(
        typeInfo.typeAnnotation,
        'typescript',
        { tabSize: 2 },
      );
      setHighlightedType(typeHtml);

      if (
        typeInfo.signature &&
        typeInfo.signature !== typeInfo.typeAnnotation
      ) {
        const sigHtml = await monaco.editor.colorize(
          typeInfo.signature,
          'typescript',
          { tabSize: 2 },
        );
        setHighlightedSig(sigHtml);
      } else {
        setHighlightedSig('');
      }
    };

    colorize();
  }, [monaco, typeInfo]);

  if (!typeInfo) {
    return (
      <div className="flex items-center px-4 py-1.5 bg-mantle border-t border-surface0/50 text-xxs font-mono text-overlay1 shrink-0 italic">
        {language === 'typescript'
          ? 'Move cursor over a symbol for type info'
          : 'JavaScript output'}
      </div>
    );
  }

  const kc = kindColorClass(typeInfo.kind);
  const kcBg = kindBgClass(typeInfo.kind);
  const kcBorder = kindBorderClass(typeInfo.kind);

  return (
    <div className="flex flex-col bg-mantle border-t border-surface0/50 px-4 py-2 text-xxs md:text-xs font-mono shrink-0 max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-baseline gap-2 flex-wrap leading-relaxed">
        <span
          className={cn(
            'text-[10px] font-bold tracking-wider uppercase rounded-md px-1.5 py-0.5 shrink-0 leading-tight border transition-colors',
            kc,
            kcBg,
            kcBorder,
          )}
        >
          {typeInfo.kind}
        </span>
        <span className="text-text font-semibold shrink-0">
          {typeInfo.name || (typeInfo.kind === 'keyword' ? '' : 'unknown')}
        </span>
        <span className="text-overlay0 shrink-0">:</span>
        <div
          className="whitespace-pre-wrap break-all flex-1 min-w-0 inline-block align-baseline"
          dangerouslySetInnerHTML={{
            __html: highlightedType || typeInfo.typeAnnotation,
          }}
        />
      </div>

      {typeInfo.jsDoc && (
        <div className="mt-1.5 text-overlay1 italic whitespace-pre-wrap break-all leading-relaxed pl-2 border-l-2 border-surface1">
          {renderWithLinksAndHighlight(typeInfo.jsDoc)}
        </div>
      )}

      {highlightedSig && (
        <div className="mt-1.5 text-overlay1 whitespace-pre-wrap break-all leading-relaxed opacity-80">
          <div dangerouslySetInnerHTML={{ __html: highlightedSig }} />
        </div>
      )}
    </div>
  );
}

function kindColorClass(kind: string): string {
  switch (kind) {
    case 'function':
      return 'text-blue';
    case 'type':
      return 'text-yellow';
    case 'interface':
      return 'text-teal';
    case 'class':
      return 'text-green';
    case 'parameter':
      return 'text-maroon';
    case 'property':
      return 'text-sapphire';
    case 'keyword':
      return 'text-mauve';
    case 'builtin':
      return 'text-peach';
    default:
      return 'text-lavender';
  }
}

function kindBgClass(kind: string): string {
  switch (kind) {
    case 'function':
      return 'bg-blue/10';
    case 'type':
      return 'bg-yellow/10';
    case 'interface':
      return 'bg-teal/10';
    case 'class':
      return 'bg-green/10';
    case 'parameter':
      return 'bg-maroon/10';
    case 'property':
      return 'bg-sapphire/10';
    case 'keyword':
      return 'bg-mauve/10';
    case 'builtin':
      return 'bg-peach/10';
    default:
      return 'bg-lavender/10';
  }
}

function kindBorderClass(kind: string): string {
  switch (kind) {
    case 'function':
      return 'border-blue/20';
    case 'type':
      return 'border-yellow/20';
    case 'interface':
      return 'border-teal/20';
    case 'class':
      return 'border-green/20';
    case 'parameter':
      return 'border-maroon/20';
    case 'property':
      return 'border-sapphire/20';
    case 'keyword':
      return 'border-mauve/20';
    case 'builtin':
      return 'border-peach/20';
    default:
      return 'border-lavender/20';
  }
}
