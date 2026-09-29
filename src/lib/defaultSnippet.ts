export const DEFAULT_TS = `// TypeScript Playground
// Long-press any word on mobile to see type info ✨

interface User {
  name: string;
  age: number;
  email?: string;
}

/**
 * Greets a user with a personalised message.
 * @param user The user to greet
 */
function greet(user: User): string {
  return \`Hello, \${user.name}! You are \${user.age} years old.\`;
}

const alice: User = {
  name: "Alice",
  age: 30,
  email: "alice@example.com",
};

const message = greet(alice);
console.log(message);

// Generics
function identity<T>(value: T): T {
  return value;
}

const result = identity<number>(42);
console.log("Identity:", result);

// Async / await
async function fetchData(url: string): Promise<string> {
  const response = await fetch(url);
  return response.text();
}

console.log("Type:", typeof fetchData);
`
