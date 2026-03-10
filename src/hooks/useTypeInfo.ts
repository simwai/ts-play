import { useCallback } from 'react';
import { getLanguageService, updateTSFile } from './useTSDiagnostics';
import type * as TS from 'typescript';

export interface TypeInfo {
  name:           string;
  kind:           string;
  typeAnnotation: string;
  signature?:     string;
  jsDoc?:         string;
  detail?:        string;
}

export function useTypeInfo() {
  const getTypeInfo = useCallback((code: string, offset: number): TypeInfo | null => {
    const ls = getLanguageService();
    if (!ls) return null;

    try {
      // Ensure the language service has the exact current code before querying
      updateTSFile('main.ts', code);

      const info = ls.getQuickInfoAtPosition('main.ts', offset);
      if (!info) return null;

      const ts = (window as any).ts as typeof TS;
      if (!ts) return null;

      const displayString = ts.displayPartsToString(info.displayParts);
      const docString = info.documentation ? ts.displayPartsToString(info.documentation) : undefined;

      const namePart = info.displayParts?.find((p: TS.SymbolDisplayPart) => 
        ['localName', 'parameterName', 'methodName', 'functionName', 'className', 'interfaceName', 'aliasName', 'propertyName', 'enumName', 'moduleName'].includes(p.kind)
      );

      return {
        name: namePart ? namePart.text : '',
        kind: info.kind,
        typeAnnotation: displayString,
        jsDoc: docString,
      };
    } catch (e) {
      return null;
    }
  }, []);

  return { getTypeInfo };
}
