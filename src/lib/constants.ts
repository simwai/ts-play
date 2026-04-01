export const TABS = ['ts', 'js', 'dts'] as const
export type TabType = (typeof TABS)[number]

export const DEFAULT_TSCONFIG = `{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx"
  }
}`
