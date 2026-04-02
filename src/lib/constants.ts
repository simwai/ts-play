export const TABS = ['ts', 'js', 'dts'] as const
export type TabType = (typeof TABS)[number]

export const DEFAULT_TS = `// TS Playground
// Type safe, fast, and sandboxed.

import { sample } from 'lodash-es'

const list = [1, 2, 3, 4, 5]
const picked = sample(list)

console.log('Picked:', picked)
`

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
