if (typeof Symbol.dispose === 'undefined') {
  (Symbol as any).dispose = Symbol('Symbol.dispose');
}
if (typeof Symbol.asyncDispose === 'undefined') {
  (Symbol as any).asyncDispose = Symbol('Symbol.asyncDispose');
}
