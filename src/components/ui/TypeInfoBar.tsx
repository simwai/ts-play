import React from 'react'
import { type TypeInfo } from '../../hooks/useTypeInfo'
import { type TSDiagnostic } from '../../hooks/useTSDiagnostics'

const FONT =
  "'Victor Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"

type TypeInfoBarProps = {
  typeInfo: TypeInfo | undefined
  activeDiag: TSDiagnostic | undefined
  language: 'typescript' | 'javascript'
  gutterW: number
}

function renderWithLinks(text: string) {
  const regex = /(\[[^\]]+]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g
  const parts = text.split(regex)

  return parts.map((part, i) => {
    const mdMatch = /^\[([^\]]+)]\((https?:\/\/[^\s)]+)\)$/.exec(part)
    if (mdMatch) {
      return (
        <a
          key={i}
          href={mdMatch[2]}
          target='_blank'
          rel='noopener noreferrer'
          className='text-blue underline underline-offset-2 pointer-events-auto'
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {mdMatch[1]}
        </a>
      )
    }

    const urlMatch = /^(https?:\/\/[^\s)]+)$/.exec(part)
    if (urlMatch) {
      return (
        <a
          key={i}
          href={urlMatch[1]}
          target='_blank'
          rel='noopener noreferrer'
          className='text-blue underline underline-offset-2 pointer-events-auto'
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {urlMatch[1]}
        </a>
      )
    }

    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

export function TypeInfoBar({
  typeInfo,
  activeDiag,
  language,
  gutterW,
}: TypeInfoBarProps) {
  const hasDiag = Boolean(activeDiag)
  const hasTypeInfo = !hasDiag && Boolean(typeInfo)
  const isEmpty = !hasDiag && !hasTypeInfo

  return (
    <div
      className='shrink-0 bg-mantle border-t border-surface0 py-[5px] pr-2.5 overflow-y-auto max-h-24 min-h-[26px] box-border pointer-events-auto text-[11px]'
      style={{ paddingLeft: gutterW + 8, fontFamily: FONT }}
    >
      {hasDiag && activeDiag && <DiagRow diag={activeDiag} />}
      {hasTypeInfo && typeInfo && <TypeRow info={typeInfo} />}
      {isEmpty && (
        <span className='text-overlay0 text-[10px] italic'>
          {language === 'typescript'
            ? 'Move cursor over a symbol for type info'
            : 'JavaScript output'}
        </span>
      )}
    </div>
  )
}

function DiagRow({ diag }: { diag: TSDiagnostic }) {
  const isError = diag.category === 'error'
  const colorClass = isError ? 'text-red' : 'text-yellow'
  return (
    <div className='flex items-start gap-1.5'>
      <span className={`${colorClass} shrink-0 leading-4`}>
        {isError ? '✖' : '⚠'}
      </span>
      <span
        className={`${colorClass} whitespace-pre-wrap wrap-break-word leading-4 flex-1`}
      >
        {diag.message}
      </span>
      <span className='text-overlay0 shrink-0 leading-4 text-[10px]'>
        [{diag.line + 1}:{diag.character + 1}]
      </span>
    </div>
  )
}

function TypeRow({ info }: { info: TypeInfo }) {
  const kc = kindColorClass(info.kind)
  const kcBg = kindBgClass(info.kind)
  const kcBorder = kindBorderClass(info.kind)

  return (
    <div className='flex flex-col gap-[3px]'>
      <div className='flex items-baseline gap-[5px] flex-wrap'>
        <span
          className={`text-[9px] font-bold tracking-[0.08em] uppercase rounded-[3px] px-1 py-px shrink-0 leading-3.5 border ${kc} ${kcBg} ${kcBorder}`}
        >
          {info.kind}
        </span>
        <span className='text-text font-semibold shrink-0'>{info.name}</span>
        <span className='text-overlay0 shrink-0'>:</span>
        <span className='text-yellow whitespace-pre-wrap wrap-break-word flex-[1_1_120px] min-w-0'>
          {info.typeAnnotation}
        </span>
      </div>

      {info.jsDoc && (
        <div className='text-overlay1 text-[10px] italic whitespace-pre-wrap wrap-break-word leading-[15px] pl-1 border-l-2 border-surface1'>
          {renderWithLinks(info.jsDoc)}
        </div>
      )}

      {info.signature && info.signature !== info.typeAnnotation && (
        <div className='text-overlay1 text-[10px] whitespace-pre-wrap wrap-break-word leading-[15px]'>
          {renderWithLinks(info.signature)}
        </div>
      )}
    </div>
  )
}

function kindColorClass(kind: string): string {
  switch (kind) {
    case 'function': {
      return 'text-blue'
    }

    case 'type': {
      return 'text-yellow'
    }

    case 'interface': {
      return 'text-teal'
    }

    case 'class': {
      return 'text-green'
    }

    case 'parameter': {
      return 'text-maroon'
    }

    case 'property': {
      return 'text-sapphire'
    }

    case 'keyword': {
      return 'text-mauve'
    }

    case 'builtin': {
      return 'text-peach'
    }

    default: {
      return 'text-lavender'
    }
  }
}

function kindBgClass(kind: string): string {
  switch (kind) {
    case 'function': {
      return 'bg-blue/20'
    }

    case 'type': {
      return 'bg-yellow/20'
    }

    case 'interface': {
      return 'bg-teal/20'
    }

    case 'class': {
      return 'bg-green/20'
    }

    case 'parameter': {
      return 'bg-maroon/20'
    }

    case 'property': {
      return 'bg-sapphire/20'
    }

    case 'keyword': {
      return 'bg-mauve/20'
    }

    case 'builtin': {
      return 'bg-peach/20'
    }

    default: {
      return 'bg-lavender/20'
    }
  }
}

function kindBorderClass(kind: string): string {
  switch (kind) {
    case 'function': {
      return 'border-blue/40'
    }

    case 'type': {
      return 'border-yellow/40'
    }

    case 'interface': {
      return 'border-teal/40'
    }

    case 'class': {
      return 'border-green/40'
    }

    case 'parameter': {
      return 'border-maroon/40'
    }

    case 'property': {
      return 'border-sapphire/40'
    }

    case 'keyword': {
      return 'border-mauve/40'
    }

    case 'builtin': {
      return 'border-peach/40'
    }

    default: {
      return 'border-lavender/40'
    }
  }
}
