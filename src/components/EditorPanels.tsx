import React, { type RefObject } from 'react'
import { CodeEditor, type CodeEditorRef } from './CodeEditor'
import type { TabType } from '../lib/constants'
import type { ThemeMode } from '../lib/theme'
import type { TSDiagnostic, TypeInfo } from '../lib/types'

type EditorPanelsProps = {
  activeTab: TabType
  tsEditorRef: RefObject<CodeEditorRef | null>
  jsEditorRef: RefObject<CodeEditorRef | null>
  dtsEditorRef: RefObject<CodeEditorRef | null>
  tsCode: string
  setTsCode: (val: string) => void
  jsCode: string
  handleJsChange: (val: string) => void
  dtsCode: string
  setDtsCode: (val: string) => void
  onTsCursorChange: (pos: number) => void
  setCursorPos: (pos: { line: number; col: number } | null) => void
  setTypeInfo: (info: TypeInfo | null) => void
  setMonacoDiagnostics: (diags: TSDiagnostic[]) => void
  packageTypings: Record<string, string>
  isMobileLike: boolean
  lineWrap: boolean
  themeMode: ThemeMode
}

export function EditorPanels({
  activeTab,
  tsEditorRef,
  jsEditorRef,
  dtsEditorRef,
  tsCode,
  setTsCode,
  jsCode,
  handleJsChange,
  dtsCode,
  setDtsCode,
  onTsCursorChange,
  setCursorPos,
  setTypeInfo,
  setMonacoDiagnostics,
  packageTypings,
  isMobileLike,
  lineWrap,
  themeMode,
}: EditorPanelsProps) {
  const tabOffsetStyle = {
    left: activeTab === 'ts' ? '0' : activeTab === 'js' ? '-100%' : '-200%',
  }

  return (
    <div
      data-testid='swipe-container'
      className='flex-1 overflow-hidden relative min-h-0'
    >
      <div
        className='flex w-[300%] h-full transition-[left] duration-300 ease-in-out relative'
        style={tabOffsetStyle}
      >
        <div className='w-[33.333%] h-full shrink-0'>
          <CodeEditor
            path='file:///main.ts'
            ref={tsEditorRef}
            value={tsCode}
            onChange={setTsCode}
            onCursorChange={onTsCursorChange}
            onCursorPosChange={setCursorPos}
            onTypeInfoChange={setTypeInfo}
            onDiagnosticsChange={setMonacoDiagnostics}
            language='typescript'
            extraLibs={packageTypings}
            isMobileLike={isMobileLike}
            lineWrap={lineWrap}
            themeMode={themeMode}
          />
        </div>
        <div className='w-[33.333%] h-full shrink-0'>
          <CodeEditor
            path='file:///main.js'
            ref={jsEditorRef}
            value={jsCode}
            onChange={handleJsChange}
            onCursorPosChange={setCursorPos}
            language='javascript'
            isMobileLike={isMobileLike}
            lineWrap={lineWrap}
            themeMode={themeMode}
          />
        </div>
        <div className='w-[33.333%] h-full shrink-0'>
          <CodeEditor
            path='file:///main.d.ts'
            ref={dtsEditorRef}
            value={dtsCode}
            onChange={setDtsCode}
            onCursorPosChange={setCursorPos}
            language='typescript'
            readOnly={true}
            isMobileLike={isMobileLike}
            lineWrap={lineWrap}
            themeMode={themeMode}
          />
        </div>
      </div>
    </div>
  )
}
