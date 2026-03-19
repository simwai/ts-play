import { cn } from '../../lib/utils'
import type { TSDiagnostic, TypeInfo } from '../../lib/types'
import { buildHtml } from '../../lib/editor-utils'

type TypeInfoBarProps = {
  typeInfo?: TypeInfo
  activeDiag?: TSDiagnostic
  language: string
  gutterW: number
}

function formatJSDoc(doc: string): string {
  return doc.replace(/`([^`]+)`/g, (_, code) => {
    return `<code class="bg-surface0 px-1 rounded text-blue font-mono">${buildHtml(code)}</code>`
  })
}

export function TypeInfoBar({ typeInfo, activeDiag, language, gutterW }: TypeInfoBarProps) {
  const hasInfo = !!(typeInfo || activeDiag)

  return (
    <div className='h-20 bg-mantle border-t border-surface0 shrink-0 flex flex-col relative z-30 overflow-hidden'>
      <div className='flex-1 flex items-center px-4 overflow-x-auto no-scrollbar' style={{ paddingLeft: gutterW + 16 }}>
        {!hasInfo ? (
          <span className='text-xxs text-overlay1 font-mono italic'>
            Move cursor over a symbol for type info
          </span>
        ) : (
          <div className='flex flex-col justify-center min-w-0 py-2'>
            {activeDiag ? (
              <div className='flex items-start gap-2 text-red group'>
                <span className='text-xxs font-bold shrink-0 mt-0.5'>[Error]</span>
                <span className='text-xxs font-medium leading-relaxed break-words line-clamp-2'>
                  {activeDiag.message}
                </span>
              </div>
            ) : (
              typeInfo && (
                <div className='flex flex-col gap-1.5 min-w-0'>
                  <div className='flex items-baseline gap-2 overflow-hidden'>
                    <span className='text-xxs font-bold text-mauve shrink-0'>{typeInfo.kind}</span>
                    <span
                      className='text-xxs font-mono text-text truncate'
                      dangerouslySetInnerHTML={{ __html: buildHtml(typeInfo.typeAnnotation) }}
                    />
                  </div>
                  {typeInfo.jsDoc && (
                    <p
                      className='text-3xs text-subtext0 leading-normal line-clamp-2 italic'
                      dangerouslySetInnerHTML={{ __html: formatJSDoc(typeInfo.jsDoc) }}
                    />
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div className='absolute bottom-1 right-3 pointer-events-none'>
        <span className='text-4xs font-bold text-surface2 uppercase tracking-widest font-mono'>{language}</span>
      </div>
    </div>
  )
}
