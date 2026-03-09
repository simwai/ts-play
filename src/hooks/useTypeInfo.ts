import { useCallback } from 'react';
import { getLanguageService, updateTSFile } from './useTSDiagnostics';

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

      const ts = (window as any).ts;
      if (!ts) return null;

      const displayString = ts.displayPartsToString(info.displayParts);
      const docString = ts.displayPartsToString(info.documentation);

      const namePart = info.displayParts?.find((p: any) => 
        ['localName', 'parameterName', 'methodName', 'functionName', 'className', 'interfaceName', 'aliasName', 'propertyName', 'enumName', 'moduleName'].includes(p.kind)
      );

      return {
        name: namePart ? namePart.text : '',
        kind: info.kind,
        typeAnnotation: displayString,
        jsDoc: docString || undefined,
      };
    } catch (e) {
      return null;
    }
  }, []);

  return { getTypeInfo };
}
