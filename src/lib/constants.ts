export const TABS = ['ts', 'js', 'dts'] as const
export type TabType = (typeof TABS)[number]
