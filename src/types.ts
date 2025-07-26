declare global {
	export const Result: ResultConstructor;

	// ───────────────────────────────────────────────────────────
	// Raw form (no methods) — discriminated union
	// ───────────────────────────────────────────────────────────

	interface OkResult<T> {
		readonly ok: true;
		readonly value: T;
	}
	interface ErrorResult<E = unknown> {
		readonly ok: false;
		readonly error: E;
	}
	type ResultLike<T, E = unknown> = OkResult<T> | ErrorResult<E>;

	// ───────────────────────────────────────────────────────────
	// 1) Synchronous Result
	// ───────────────────────────────────────────────────────────

	interface ResultPrototype<T, E> {
		map<U>(callbackFn: (value: T) => PromiseLike<U>): AsyncResult<U, E>;
		map<U>(callbackFn: (value: T) => U): Result<U, E>;

		flatMap<U, F = E>(
			callbackFn: (value: T) => PromiseLike<Result<U, F>>,
		): AsyncResult<U, F>;
		flatMap<U, F = E>(callbackFn: (value: T) => Result<U, F>): Result<U, F>;

		mapError<F>(callbackFn: (error: E) => PromiseLike<F>): AsyncResult<T, F>;
		mapError<F>(callbackFn: (error: E) => F): Result<T, F>;

		flatMapError<U, F = E>(
			callbackFn: (error: E) => PromiseLike<Result<U, F>>,
		): AsyncResult<U, F>;
		flatMapError<U, F = E>(callbackFn: (error: E) => Result<U, F>): Result<U, F>;

		catch<U>(callbackFn: (error: E) => PromiseLike<U>): AsyncResult<U, never>;
		catch<U>(callbackFn: (error: E) => U): Result<U, never>;

		tap(onOk: (value: T) => PromiseLike<void>): AsyncResult<T, E>;
		tap(onOk: (value: T) => void): Result<T, E>;

		tapError(onError: (error: E) => PromiseLike<void>): AsyncResult<T, E>;
		tapError(onError: (error: E) => void): Result<T, E>;

		finally(onFinally: () => PromiseLike<void>): AsyncResult<T, E>;
		finally(onFinally: () => void): Result<T, E>;

		match<TValue, TError>(
			onOk: (value: T) => TValue,
			onError: (error: E) => TError,
		): TValue | TError;

		readonly [Symbol.toStringTag]: "Result";
	}

	type Result<T, E = unknown> = (OkResult<T> | ErrorResult<E>) & ResultPrototype<T, E>;

	interface ResultConstructor {
		new <T, E = unknown>(
			executor: (
				ok: (v: T) => Result<T, never>,
				error: (e: E) => Result<never, E>,
			) => Result<T, E>,
		): Result<T, E>;
		ok<T>(value: T): Result<T, never>;
		error<E>(error: E): Result<never, E>;
		try<T, E = unknown>(callbackFn: () => T): Result<T, E>;
		all<T, E = unknown>(iterable: Iterable<Result<T, E>>): Result<T[], E>;
		from<T, E = unknown>(result: ResultLike<T, E>): Result<T, E>;
		isResult(result: unknown): result is Result<unknown, unknown>;

		// —— Allow subclassing / species-aware APIs (mirrors Promise.species)
		readonly [Symbol.species]: ResultConstructor;

		readonly prototype: Result<unknown, unknown>;
	}

	// ───────────────────────────────────────────────────────────
	// 2) Asynchronous AsyncResult
	// ───────────────────────────────────────────────────────────

	export const AsyncResult: AsyncResultConstructor;

	interface AsyncResultPrototype<T, E> {
		map<U>(callbackFn: (value: T) => U | PromiseLike<U>): AsyncResult<U, E>;
		flatMap<U, F = E>(callbackFn: (value: T) => AsyncResult<U, F>): AsyncResult<U, F>;

		mapError<F>(callbackFn: (error: E) => PromiseLike<F>): AsyncResult<T, F>;
		mapError<F>(callbackFn: (error: E) => F): AsyncResult<T, F>;


		catch<U>(callbackFn: (error: E) => PromiseLike<U>): AsyncResult<U, never>;
		catch<U>(callbackFn: (error: E) => U): AsyncResult<U, never>;

		flatMapError<U, F = E>(
			callbackFn: (error: E) => AsyncResult<U, F>,
		): AsyncResult<U, F>;

		tap(onOk: (value: T) => void | PromiseLike<void>): AsyncResult<T, E>;
		tapError(onError: (error: E) => void | PromiseLike<void>): AsyncResult<T, E>;
		finally(onFinally: () => void | PromiseLike<void>): AsyncResult<T, E>;

		match<TValue, TError>(
			onOk: (value: T) => TValue | PromiseLike<TValue>,
			onError: (error: E) => TError | PromiseLike<TError>,
		): Promise<TValue | TError>;

		// —— Tag for branding
		readonly [Symbol.toStringTag]: "AsyncResult";
	}

	interface AsyncResult<T, E = unknown>
		extends PromiseLike<Result<T, E>>,
			AsyncResultPrototype<T, E> {}

	interface AsyncResultConstructor {
		new <T, E = unknown>(
			executor: (ok: (value: T) => void, err: (error: E) => void) => void,
		): AsyncResult<T, E>;

		ok<T>(value: T): AsyncResult<T, never>;
		error<E>(error: E): AsyncResult<never, E>;
		try<T, E = unknown>(callbackFn: () => T | Promise<T>): AsyncResult<T, E>;
		all<T, E = unknown>(iterable: Iterable<T | AsyncResult<T, E>>): AsyncResult<T[], E>;
		from<T, E = unknown>(
			result: ResultLike<T, E> | Promise<ResultLike<T, E>>,
		): AsyncResult<T, E>;
		fromPromise<T, E = unknown>(
			promise: Promise<T>,
			mapErrorFn?: (reason: unknown) => E,
		): AsyncResult<T, E>;
		isAsyncResult(asyncResult: unknown): asyncResult is AsyncResult<unknown, unknown>;

		// —— Species for correct subclassing via `then()`
		readonly [Symbol.species]: AsyncResultConstructor;

		readonly prototype: AsyncResult<unknown, unknown>;
	}
}

export {};