/**
 * Polyfill for Explicit Resource Management (using / await using)
 * This ensures Symbol.dispose and Symbol.asyncDispose are available in the runtime.
 */
if (typeof (Symbol as any).dispose === 'undefined') {
  Object.defineProperty(Symbol, 'dispose', {
    value: Symbol('Symbol.dispose'),
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

if (typeof (Symbol as any).asyncDispose === 'undefined') {
  Object.defineProperty(Symbol, 'asyncDispose', {
    value: Symbol('Symbol.asyncDispose'),
    configurable: false,
    enumerable: false,
    writable: false,
  });
}
