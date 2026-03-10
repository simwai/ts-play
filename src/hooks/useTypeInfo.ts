import { useCallback } from 'react';
import { workerClient } from '../lib/workerClient';

export interface TypeInfo {
  name:           string;
  kind:           string;
  typeAnnotation: string;
  signature?:     string;
  jsDoc?:         string;
  detail?:        string;
}

export function useTypeInfo() {
  const getTypeInfo = useCallback(async (code: string, offset: number): Promise<TypeInfo | null> => {
    try {
      await workerClient.updateFile('main.ts', code);
      return await workerClient.getTypeInfo(offset);
    } catch (e) {
      return null;
    }
  }, []);

  return { getTypeInfo };
}
