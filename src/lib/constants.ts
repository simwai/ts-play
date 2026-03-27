export const TABS = ['ts', 'js', 'dts'] as const
export type TabType = (typeof TABS)[number]

export const DEFAULT_TSCONFIG = `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "outDir": "dist",
    "declaration": true,
    "emitDeclarationOnly": false,
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "allowJs": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    "noImplicitOverride": true
  },
  "include": ["index.ts"]
}`
