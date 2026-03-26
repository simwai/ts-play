export type EnvironmentStatus =
  | 'idle'
  | 'booting'
  | 'preparing'
  | 'ready'
  | 'error';

export type CompilerStatus =
  | 'Idle'
  | 'Preparing'
  | 'Running'
  | 'Compiling'
  | 'Ready'
  | 'Error';

export type PackageManagerStatus =
  | 'idle'
  | 'installing'
  | 'uninstalling'
  | 'syncing'
  | 'error';
