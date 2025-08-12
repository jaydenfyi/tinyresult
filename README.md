<h1 align="center">🔀 tinyresult</h1>

A tiny, zero-dependency library for handling synchronous and asynchronous results with robust error handling.

<p align="center">
	<a href="http://npmjs.com/package/@jaydenfyi/tinyresult"><img alt="📦 npm version" src="https://img.shields.io/npm/v/@jaydenfyi/tinyresult?color=21bb42&label=%F0%9F%93%A6%20npm" /></a>
	<a href="https://github.com/jaydenfyi/tinyresult/blob/main/LICENSE.md" target="_blank"><img alt="📝 License: MIT" src="https://img.shields.io/badge/%F0%9F%93%9D_license-MIT-21bb42.svg"></a>
	<img alt="💪 TypeScript: Strict" src="https://img.shields.io/badge/%F0%9F%92%AA_typescript-strict-21bb42.svg" />
  <img src="https://img.shields.io/bundlejs/size/%40jaydenfyi%2Ftinyresult"/>
</p>

---

## Key Features

- 🛡️ **Type-Safe**: Makes errors first‑class values in the type system - `Result<T, E>` infers and bubbles up both `T` and `E`, letting you chain and handle failures without throwing.
- 🔄 **Seamless Sync/Async Context Boundaries**: Provides `Result` for synchronous operations and `AsyncResult` for promise-based workflows, with seamless interoperability between them via chaining API methods.
- 🛠️ **Familiar, Fluent & Immutable API**: Inspired by ECMAScript built‑ins - use chainable methods like `map`, `flatMap`, `catch` and `finally` to compose workflows cleanly.
- 📦 **Zero-Dependency**: Lightweight with no external dependencies.

---

## Installation

```shell
npm install @jaydenfyi/tinyresult
```

## Getting Started

`tinyresult` provides a straightforward way to manage operations that can either succeed or fail. Here's a more comprehensive example that showcases chaining and asynchronous operations.

```typescript
import { Result, AsyncResult } from '@jaydenfyi/tinyresult';
import { Octokit } from '@octokit/rest';

class ValidationError {
	readonly _tag = 'ValidationError';
	constructor(readonly message: string) {}
}

class NetworkError {
	readonly _tag = 'NetworkError';
	constructor(
		readonly status: number,
		readonly message: string,
	) {}
}

class UserNotFoundError {
	readonly _tag = 'UserNotFoundError';
	constructor(readonly username: string) {}
}

const octokit = new Octokit();

function getGithubUserBio(username: string) {
	return (
		// Step 1: Start with a synchronous value
		Result.ok(username)
			// Step 2: Validate the input
			.flatMap((u) =>
				!u || u.trim().length === 0
					? Result.error(
							new ValidationError('Username cannot be empty'),
						)
					: Result.ok(u),
			)
			// Step 3: Log the valid input (side-effect)
			.tap((u) => console.log(`Fetching bio for ${u}...`))
			// Step 4: Switch to an async context to fetch data
			.flatMap((u) =>
				AsyncResult.fromPromise(
					octokit.users.getByUsername({ username: u }),
					(err) => new NetworkError(500, err.message),
				),
			)
			// Step 5: Check the response and extract the data
			.flatMap((response) =>
				response.status !== 200
					? Result.error(
							new NetworkError(
								response.status,
								'Failed to fetch user',
							),
						)
					: Result.ok(response.data),
			)
			// Step 6: Process the data
			.flatMap((user) =>
				!user.bio
					? Result.error(new UserNotFoundError(user.login))
					: Result.ok({ bio: user.bio, login: user.login }),
			)
			// Step 7: Transform the success value
			.map(({ bio, login }) => ({
				bio,
				bioLength: bio.length,
				user: login,
			}))
			// Step 8: Log any errors that occurred in the chain
			.tapError((err) => console.error(`[Error Log]: ${err._tag}`))
	);
}

async function run() {
	const result = await getGithubUserBio('jaydenfyi');

	result.match(
		(data) => console.log('User Bio details:', data),
		(error) => {
			switch (error._tag) {
				case 'ValidationError':
					console.error('Validation failed:', error.message);
					break;
				case 'NetworkError':
					console.error(
						`Network error (${error.status}):`,
						error.message,
					);
					break;
				case 'UserNotFoundError':
					console.error(
						`Could not find a bio for user: ${error.username}`,
					);
					break;
			}
		},
	);
}

run();
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

## Prior Art & Inspiration

- [neverthrow](https://github.com/supermacro/neverthrow)
- [ECMAScript Try Operator Proposal](https://github.com/arthurfiorette/proposal-try-operator)
- [Effect.ts](https://github.com/Effect-TS/effect)
