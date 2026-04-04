import React, { useEffect, useState } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useMonaco } from '@monaco-editor/react'
import { RegexPatterns, toRegExp } from '../../lib/regex'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type TypeInfo = {
  name: string
  kind: string
  typeAnnotation: string
  jsDoc?: string
  signature?: string
}

type TypeInfoBarProps = {
  typeInfo: TypeInfo | null
  cursorPos: { line: number; col: number } | null
  language: 'typescript' | 'javascript'
  themeMode?: string
}

function renderWithLinksAndHighlight(text: string) {
  const regex = toRegExp(RegexPatterns.MARKDOWN_LINKS_OR_CODE)
  const parts = text.split(regex)

  return parts.map((part, i) => {
    const mdMatch = toRegExp(RegexPatterns.MARKDOWN_LINK).exec(part)
    if (mdMatch) {
      return (
        <a
          key={i}
          href={mdMatch[2]}
          target='_blank'
          rel='noopener noreferrer'
          className='text-mauve underline underline-offset-2 hover:text-pink transition-colors'
          onClick={(e) => e.stopPropagation()}
        >
          {mdMatch[1]}
        </a>
      )
    }

    const urlMatch = toRegExp(RegexPatterns.URL).exec(part)
    if (urlMatch) {
      return (
        <a
          key={i}
          href={urlMatch[1]}
          target='_blank'
          rel='noopener noreferrer'
          className='text-mauve underline underline-offset-2 hover:text-pink transition-colors'
          onClick={(e) => e.stopPropagation()}
        >
          {urlMatch[1]}
        </a>
      )
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className='bg-surface0 px-1 rounded-sm text-mauve'
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

export function TypeInfoBar({
  typeInfo,
  cursorPos,
  language,
  themeMode = 'mocha',
}: TypeInfoBarProps) {
  const monaco = useMonaco()
  const [highlightedType, setHighlightedType] = useState('')
  const [highlightedSig, setHighlightedSig] = useState('')

  useEffect(() => {
    if (!monaco || !typeInfo) {
      setHighlightedType('')
      setHighlightedSig('')
      return
    }

    const colorize = async () => {
      const typeHtml = await monaco.editor.colorize(
        typeInfo.typeAnnotation,
        'typescript',
        { tabSize: 2 }
      )
      setHighlightedType(typeHtml)

      if (
        typeInfo.signature &&
        typeInfo.signature !== typeInfo.typeAnnotation
      ) {
        const sigHtml = await monaco.editor.colorize(
          typeInfo.signature,
          'typescript',
          { tabSize: 2 }
        )
        setHighlightedSig(sigHtml)
      } else {
        setHighlightedSig('')
      }
    }

    colorize()
  }, [monaco, typeInfo])

  const renderCursorPos = () => {
    if (!cursorPos) return null
    return (
      <span className='text-overlay0 ml-auto shrink-0 select-none text-[10px] md:text-xxs font-mono'>
        Ln {cursorPos.line}, Col {cursorPos.col}
      </span>
    )
  }

  if (!typeInfo) {
    return (
      <div className='flex items-center px-3 md:px-4 py-1.5 bg-mantle border-t border-surface0/50 text-[10px] md:text-xxs font-mono text-overlay1 shrink-0 italic h-8 md:h-9'>
        <span className='truncate'>
          {language === 'typescript'
            ? 'Move cursor over a symbol for type info'
            : 'JavaScript output'}
        </span>
        {renderCursorPos()}
      </div>
    )
  }

  const kindLabel = getKindLabel(typeInfo.kind)
  const kc = kindColorClass(typeInfo.kind)
  const kcBg = kindBgClass(typeInfo.kind)
  const kcBorder = kindBorderClass(typeInfo.kind)

  return (
    <div className='flex flex-col bg-mantle border-t border-surface0/50 px-3 md:px-4 py-1.5 md:py-2 font-mono shrink-0 max-h-48 overflow-hidden animate-in slide-in-from-bottom-2 duration-200'>
      <div className='flex items-center gap-2 mb-1 shrink-0'>
        {kindLabel && (
          <span
            className={cn(
              'text-[9px] md:text-[10px] font-bold tracking-wider uppercase rounded px-1.5 py-0.5 leading-tight border transition-colors shrink-0',
              kc,
              kcBg,
              kcBorder
            )}
          >
            {kindLabel}
          </span>
        )}
        <span className='text-text font-semibold text-xxs md:text-xs truncate max-w-[40%] md:max-w-none'>
          {typeInfo.name || (typeInfo.kind === 'keyword' ? '' : 'unknown')}
        </span>
        {renderCursorPos()}
      </div>

      <div className='overflow-y-auto min-h-0 flex-1 scrollbar-hide'>
        <div className='flex flex-col gap-1.5'>
          <div className='flex items-start gap-1'>
            <span className='text-overlay0 shrink-0 mt-0.5 text-xxs md:text-xs'>
              :
            </span>
            <div
              className='whitespace-pre-wrap break-all text-xxs md:text-xs leading-relaxed flex-1 text-subtext1'
              dangerouslySetInnerHTML={{
                __html: highlightedType || typeInfo.typeAnnotation,
              }}
            />
          </div>

          {typeInfo.jsDoc && (
            <div className='text-overlay1 italic whitespace-pre-wrap break-all leading-relaxed pl-2 border-l-2 border-surface1 text-[10px] md:text-xxs'>
              {renderWithLinksAndHighlight(typeInfo.jsDoc)}
            </div>
          )}

          {highlightedSig && (
            <div className='text-overlay1 whitespace-pre-wrap break-all leading-relaxed opacity-80 text-[10px] md:text-xxs'>
              <div dangerouslySetInnerHTML={{ __html: highlightedSig }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getKindLabel(kind: string): string {
  switch (kind) {
    case 'var':
    case 'let':
    case 'const':
    case 'variable':
      return 'var'
    case 'function':
    case 'local function':
      return 'func'
    case 'method':
    case 'constructor':
      return 'method'
    case 'property':
    case 'getter':
    case 'setter':
      return 'prop'
    case 'class':
      return 'class'
    case 'interface':
      return 'intf'
    case 'type':
    case 'alias':
      return 'type'
    case 'enum':
      return 'enum'
    case 'module':
      return 'module'
    case 'parameter':
      return 'param'
    case 'keyword':
      return 'key'
    case 'string':
    case 'number':
    case 'boolean':
    case 'primitive':
      return 'prim'
    default:
      return (typeof kind === "string") ? kind.substring(0, 4) : ""
  }
}

function kindColorClass(kind: string): string {
  switch (kind) {
    case 'function':
    case 'local function':
    case 'method':
    case 'constructor':
      return 'text-blue'
    case 'type':
    case 'interface':
    case 'alias':
      return 'text-yellow'
    case 'class':
      return 'text-green'
    case 'parameter':
      return 'text-maroon'
    case 'property':
    case 'getter':
    case 'setter':
      return 'text-sapphire'
    case 'keyword':
      return 'text-mauve'
    case 'builtin':
      return 'text-peach'
    case 'var':
    case 'let':
    case 'const':
    case 'variable':
      return 'text-lavender'
    default:
      return 'text-overlay1'
  }
}

function kindBgClass(kind: string): string {
  switch (kind) {
    case 'function':
    case 'local function':
    case 'method':
    case 'constructor':
      return 'bg-blue/10'
    case 'type':
    case 'interface':
    case 'alias':
      return 'bg-yellow/10'
    case 'class':
      return 'bg-green/10'
    case 'parameter':
      return 'bg-maroon/10'
    case 'property':
    case 'getter':
    case 'setter':
      return 'bg-sapphire/10'
    case 'keyword':
      return 'bg-mauve/10'
    case 'builtin':
      return 'bg-peach/10'
    case 'var':
    case 'let':
    case 'const':
    case 'variable':
      return 'bg-lavender/10'
    default:
      return 'bg-overlay1/10'
  }
}

function kindBorderClass(kind: string): string {
  switch (kind) {
    case 'function':
    case 'local function':
    case 'method':
    case 'constructor':
      return 'border-blue/20'
    case 'type':
    case 'interface':
    case 'alias':
      return 'border-yellow/20'
    case 'class':
      return 'border-green/20'
    case 'parameter':
      return 'border-maroon/20'
    case 'property':
    case 'getter':
    case 'setter':
      return 'border-sapphire/20'
    case 'keyword':
      return 'border-mauve/20'
    case 'builtin':
      return 'border-peach/20'
    case 'var':
    case 'let':
    case 'const':
    case 'variable':
      return 'border-lavender/20'
    default:
      return 'border-overlay1/20'
  }
}
