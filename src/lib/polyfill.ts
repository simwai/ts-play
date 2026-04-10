/**
 * Polyfill for Explicit Resource Management (using / await using)
 * This ensures Symbol.dispose and Symbol.asyncDispose are available in the runtime.
 * This implementation is sufficient for TypeScript's downleveling and runtime execution,
 * as it provides the globally unique symbols required by the ES2023 specification.
 */
if (typeof Symbol.dispose === 'undefined') {
  Object.defineProperty(Symbol, 'dispose', {
    value: Symbol('Symbol.dispose'),
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

if (typeof Symbol.asyncDispose === 'undefined') {
  Object.defineProperty(Symbol, 'asyncDispose', {
    value: Symbol('Symbol.asyncDispose'),
    configurable: false,
    enumerable: false,
    writable: false,
  });
}
