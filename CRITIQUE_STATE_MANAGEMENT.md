# CRITIQUE: State Management in TSPlay
*By Uncle Bob (or someone who sounds like him)*

Listen up. I've seen a lot of codebases in my time. Some were clean, some were dirty, and some were just plain "stupid."

TSPlay has some good bones, but the state management is currently a tangled web of concerns. Let's talk about why your "Source of Truth" is more of a "Source of Confusion."

## 1. The "Kitchen Sink" Store

Your `PlaygroundStore` is trying to do too much. It's managing:
- Environment Lifecycle (`idle`, `booting`, `ready`)
- Compiler Status (`TSC`, `Esbuild`)
- User Preferences (`theme`, `lineWrap`)
- Readiness Derivation

**Violated Principle**: Single Responsibility Principle (SRP).

Why are my user preferences mixed in with the low-level status of the WebContainer VM? If I change my theme, why does the store need to recalculate if the compiler is ready? This is a recipe for unnecessary re-renders and tightly coupled logic.

## 2. The "Global State" Antipattern

While `PlaygroundStore` is a central point of control, it's essentially a global variable in a fancy suit.

**Violated Principle**: Dependency Inversion Principle (DIP).

Components and hooks are reaching out to the `playgroundStore` singleton directly. This makes unit testing a nightmare. You can't easily swap out the store for a mock, and your components are now tightly bound to a specific implementation of state.

## 3. The Synchronization Mess

The relationship between the `PlaygroundStore` and the `WebContainerService` is a circular dependency waiting to happen.
- `WebContainerService` imports `playgroundStore` to update lifecycle.
- `App.tsx` uses `usePlaygroundStore` and passes values back to `WebContainerService` methods.

**Violated Principle**: Interface Segregation / Dependency Flow.

We should have clear boundaries. The `WebContainerService` should emit events that an external orchestrator (perhaps a high-level hook or a dedicated controller) translates into state updates. Services should not know about the application's global state store.

## 4. Derived State should be... Derived

You're manually calculating `isReady` inside `setState`.

```typescript
this.state.isReady =
  this.state.lifecycle === 'ready' &&
  this.state.tscStatus === 'Ready' &&
  this.state.esbuildStatus === 'Ready';
```

This is "Status Management," not "State Management." In a clean system, this logic should live in a selector or a derived property, not as a hard-coded field in the state object that needs to be updated every time *any* property changes.

## 5. The "I'll do it myself" Persistence

The store is manually calling `localStorage.setItem` for specific keys.

**Violated Principle**: Separation of Concerns.

Persistence should be a middleware or a separate service that listens to state changes. The store's job is to manage state, not to worry about *where* that state is stored on disk (or in the browser's storage).

## The Verdict

Your current system is "functional" but not "clean." It's a monolith of state that will grow more fragile with every feature you add.

Break it apart. Decouple your services from your store. Derive your state. Use proper dependency injection.

And for heaven's sake, keep your user's theme preferences away from your compiler's heartbeat.

*Go back to the drawing board.*
