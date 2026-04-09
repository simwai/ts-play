export const SYMBOL_KINDS = new Set([
  'localName',
  'variableName',
  'parameterName',
  'methodName',
  'functionName',
  'className',
  'interfaceName',
  'aliasName',
  'propertyName',
  'enumName',
  'enumMemberName',
  'moduleName',
  'typeParameterName',
])

export interface MonacoDisplayPart {
  text: string
  kind: string
}

export interface MonacoDocumentation {
  text: string
  kind: string
}

export function displayPartsToString(parts: MonacoDisplayPart[] | undefined): string {
  return (parts || []).map((p) => p.text).join('')
}
