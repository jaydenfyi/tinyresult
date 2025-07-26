<h1 align="center">🔀 tinyresult</h1>

A tiny, zero-dependency library for handling synchronous and asynchronous results with robust error handling, inspired by Rust's `Result` type.

<p align="center">
	<a href="http://npmjs.com/package/@jaydenfyi/tinyresult"><img alt="📦 npm version" src="https://img.shields.io/npm/v/@jaydenfyi/tinyresult?color=21bb42&label=%F0%9F%93%A6%20npm" /></a>
	<a href="https://github.com/Not-Jayden/tinyresult/blob/main/LICENSE.md" target="_blank"><img alt="📝 License: MIT" src="https://img.shields.io/badge/%F0%9F%93%9D_license-MIT-21bb42.svg"></a>
	<img alt="💪 TypeScript: Strict" src="https://img.shields.io/badge/%F0%9F%92%AA_typescript-strict-21bb42.svg" />
  <img src="https://img.shields.io/bundlejs/size/%40jaydenfyi%2Ftinyresult"/>
</p>

---

## Key Features

- **Type-Safe**: Leverages TypeScript to ensure that you handle both success and failure cases.
- **Seamless Sync/Async Integration**: Provides `Result` for synchronous operations and `AsyncResult` for promise-based workflows, with seamless interoperability between them.
- **Fluent & Chainable API**: A rich set of methods like `map`, `flatMap`, and `match` make result handling clean and expressive, whether your code is synchronous or asynchronous.
- **Familiar API**: Heavily inspired by existing ECMAScript built-ins, expoosing methods like `try`, `map`, `flatMap`, `catch`, and `finally` for an easy learning curve.
- **Zero-Dependency**: Lightweight with no external dependencies.

---

## Installation

```shell
npm install @jaydenfyi/tinyresult
```

## Getting Started

`tinyresult` provides a straightforward way to manage operations that can either succeed or fail. Here's a more comprehensive example that showcases chaining and asynchronous operations.

```typescript
import { Result } from "@jaydenfyi/tinyresult";

// A synchronous function that can fail
const validateUrl = (url: string): Result<URL, Error> =>
  Result.try(() => new URL(url));

// An asynchronous function using flatMap
const fetchJson = async (url: URL) =>
  Result.try(async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  });

// Chain sync and async operations
const result = await validateUrl("https://api.github.com/users/Not-Jayden")
  .map((url) => {
    console.log("URL is valid:", url.href);
    return url;
  })
  .flatMap(fetchJson)
  .map((user) => user.name);

result.match(
  (name) => console.log("User's name:", name),
  (error) => console.error("An error occurred:", error.message),
);
```

---

## API Reference

### `Result`

Handles synchronous operations.

#### Static Methods

- **`Result.ok<T>(value: T)`**: Creates a success result.
- **`Result.error<E>(error: E)`**: Creates a failure result.
- **`Result.try<T, E>(fn: () => T)`**: Executes a function and catches any thrown error, returning a `Result`.
- **`Result.all<T, E>(iterable)`**: Transforms an iterable of `Result`s into a single `Result` of an array of values. If any result is an error, the first error is returned.
- **`Result.from<T, E>(resultLike)`**: Creates a `Result` from a `ResultLike` object (`{ ok: boolean, ... }`).
- **`Result.isResult(value)`**: Checks if a value is a `Result` instance.

#### Instance Methods

- **`.map<U>(fn)`**: Maps a `Result<T, E>` to `Result<U, E>` by applying a function to a success value.
- **`.flatMap<U, F>(fn)`**: Maps a `Result<T, E>` to `Result<U, F>` by applying a function that returns a `Result`.
- **`.mapError<F>(fn)`**: Maps a `Result<T, E>` to `Result<T, F>` by applying a function to a failure value.
- **`.flatMapError<U, F>(fn)`**: Maps a `Result<T, E>` to `Result<U, F>` by applying a function that returns a `Result`.
- **`.catch<U>(fn)`**: Recovers from an error by applying a function that returns a new success value.
- **`.tap(fn)`**: Performs a side-effect with the success value without changing the `Result`.
- **`.tapError(fn)`**: Performs a side-effect with the error value without changing the `Result`.
- **`.finally(fn)`**: Performs a side-effect regardless of success or failure.
- **`.match(onOk, onError)`**: Unwraps the `Result`, executing `onOk` for success or `onError` for failure.

### `AsyncResult`

A promise-like structure for asynchronous operations that resolves to a `Result`.

#### Static Methods

- **`AsyncResult.ok<T>(value: T)`**: Creates an `AsyncResult` that resolves to a success.
- **`AsyncResult.error<E>(error: E)`**: Creates an `AsyncResult` that resolves to a failure.
- **`AsyncResult.try<T, E>(fn: () => T | Promise<T>)`**: Executes an async function and catches any thrown error.
- **`AsyncResult.all<T, E>(iterable)`**: Similar to `Result.all` but for `AsyncResult`s.
- **`AsyncResult.from<T, E>(resultLike)`**: Creates an `AsyncResult` from a `ResultLike` or a `Promise<ResultLike>`.
- **`AsyncResult.fromPromise<T, E>(promise)`**: Creates an `AsyncResult` from a `Promise`.
- **`AsyncResult.isAsyncResult(value)`**: Checks if a value is an `AsyncResult` instance.

#### Instance Methods

`AsyncResult` has the same chainable methods as `Result` (`map`, `flatMap`, etc.), but they operate on the promised `Result` and can accept async callbacks.

- **`.then()`**: `AsyncResult` is "thenable" and can be awaited directly in async functions.
- **`.match(onOk, onError)`**: Returns a `Promise` that resolves with the result of `onOk` or `onError`.