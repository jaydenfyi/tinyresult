import {
	catchError as catchErrorFn,
	flatMap as flatMapFn,
	flatMapError as flatMapErrorFn,
	map as mapFn,
	mapError as mapErrorFn,
	match as matchFn,
	tap as tapFn,
	tapBoth as tapBothFn,
	tapError as tapErrorFn,
	tryCatch as tryCatchFn,
	all as allFn,
	type Result as ResultLike,
	type MaybeAsyncResult as MaybeAsyncResultLike,
	type ResolveOkValue,
	type ResolveErrorValue,
} from './core/index.js';
import { isPromiseLike } from './core/internal.js';

// Type utilities

type ResultLikeInternal<T, E = unknown> = {
	ok: boolean;
	value?: T;
	error?: E;
};
type ExtractOkResultValues<T> = {
	-readonly [K in keyof T]: T[K] extends Result<infer U, any> ? U : T[K];
};

type ExtractErrorResultValue<T> = T extends readonly Result<any, infer E>[]
	? E
	: never;

// Result types

export interface ResultPrototype<T, E> {
	map<U>(callbackFn: (value: T) => U): Result<U, E>;

	flatMap<U, F = E>(
		callbackFn: (value: T) => PromiseLike<Result<U, F>>,
	): AsyncResult<U, E | F>;
	flatMap<U, F = E>(callbackFn: (value: T) => Result<U, F>): Result<U, E | F>;

	mapError<F>(callbackFn: (error: E) => F): Result<T, F>;

	flatMapError<U, F = E>(
		callbackFn: (error: E) => PromiseLike<Result<U, F>>,
	): AsyncResult<T | U, F>;
	flatMapError<U, F = E>(
		callbackFn: (error: E) => Result<U, F>,
	): Result<T | U, F>;

	catch<U>(callbackFn: (error: E) => U): Result<T | U, never>;

	tap(onOk: (value: T) => void): Result<T, E>;

	tapError(onError: (error: E) => void): Result<T, E>;

	finally(onFinally: () => void): Result<T, E>;

	match<TValue, TError>(
		onOk: (value: T) => TValue,
		onError: (error: E) => TError,
	): TValue | TError;

	readonly [Symbol.toStringTag]: 'Result';
}

export type Result<T, E = unknown> = ResultLike<T, E> & ResultPrototype<T, E>;

export interface ResultConstructor {
	ok<T>(value: T): Result<T, never>;

	error<E>(error: E): Result<never, E>;

	try<T>(callbackFn: () => PromiseLike<T>): AsyncResult<T, unknown>;
	try<T>(callbackFn: () => T): Result<T, unknown>;
	try<T, F>(
		callbackFn: () => PromiseLike<T>,
		onError: (e: unknown) => F,
	): AsyncResult<T, F>;
	try<T, F>(callbackFn: () => T, onError: (e: unknown) => F): Result<T, F>;

	all<const T extends readonly ResultLike<any, any>[]>(
		results: T,
	): Result<ExtractOkResultValues<T>, ExtractErrorResultValue<T>>;

	from<T, E = unknown>(result: ResultLike<T, E>): Result<T, E>;

	isResult(result: unknown): result is Result<unknown, unknown>;

	readonly [Symbol.species]: ResultConstructor;

	readonly prototype: Result<unknown, unknown>;
}

// AsyncResult types

export interface AsyncResultPrototype<T, E> {
	map<U>(callbackFn: (value: T) => U | PromiseLike<U>): AsyncResult<U, E>;

	flatMap<U, F = E>(
		callbackFn: (value: T) => Result<U, F> | AsyncResult<U, F>,
	): AsyncResult<U, E | F>;

	mapError<F>(callbackFn: (error: E) => F): AsyncResult<T, F>;

	catch<U>(
		callbackFn: (error: E) => U | PromiseLike<U>,
	): AsyncResult<T | U, never>;

	flatMapError<U, F = E>(
		callbackFn: (error: E) => Result<U, F> | AsyncResult<U, F>,
	): AsyncResult<T | U, F>;

	tap(onOk: (value: T) => void | PromiseLike<void>): AsyncResult<T, E>;

	tapError(
		onError: (error: E) => void | PromiseLike<void>,
	): AsyncResult<T, E>;

	finally(onFinally: () => void | PromiseLike<void>): AsyncResult<T, E>;

	match<TValue, TError>(
		onOk: (value: T) => TValue | PromiseLike<TValue>,
		onError: (error: E) => TError | PromiseLike<TError>,
	): Promise<TValue | TError>;

	readonly [Symbol.toStringTag]: 'AsyncResult';
}

export interface AsyncResult<T, E = unknown>
	extends PromiseLike<Result<T, E>>,
		AsyncResultPrototype<T, E> {}

export interface AsyncResultConstructor {
	ok<T>(value: T): AsyncResult<T, never>;

	error<E>(error: E): AsyncResult<never, E>;

	try<T>(callbackFn: () => PromiseLike<T>): AsyncResult<T, unknown>;
	try<T>(callbackFn: () => T): AsyncResult<T, unknown>;
	try<T, F>(
		callbackFn: () => PromiseLike<T>,
		onError: (e: unknown) => F,
	): AsyncResult<T, F>;
	try<T, F>(
		callbackFn: () => T,
		onError: (e: unknown) => F,
	): AsyncResult<T, F>;

	all<R extends readonly MaybeAsyncResult<any, any>[]>(
		results: R,
	): AsyncResult<
		{ -readonly [K in keyof R]: ResolveOkValue<R[K]> },
		ResolveErrorValue<R[number]>
	>;

	from<T, E = unknown>(result: MaybeAsyncResultLike<T, E>): AsyncResult<T, E>;

	fromPromise<T, E = unknown>(
		promise: Promise<T>,
		onError?: (reason: unknown) => E,
	): AsyncResult<T, E>;

	isAsyncResult(
		asyncResult: unknown,
	): asyncResult is AsyncResult<unknown, unknown>;

	readonly [Symbol.species]: AsyncResultConstructor;

	readonly prototype: AsyncResult<unknown, unknown>;
}

type MaybeAsyncResult<T, E = unknown> = Result<T, E> | AsyncResult<T, E>;

// Result implementation

export class ResultImplementation<T, E = unknown>
	implements ResultLikeInternal<T, E>, ResultPrototype<T, E>
{
	readonly ok: boolean;
	declare readonly value?: T;
	declare readonly error?: E;

	private constructor(rawResult: ResultLike<T, E>) {
		this.ok = rawResult.ok;

		if (!rawResult.ok) {
			this.error = rawResult.error;
			return;
		}

		this.value = rawResult.value;
	}

	static ok<T>(value: T): Result<T, never> {
		return new ResultImplementation({ ok: true, value }) as Result<
			T,
			never
		>;
	}

	static error<E>(error: E): Result<never, E> {
		return new ResultImplementation({ ok: false, error }) as Result<
			never,
			E
		>;
	}

	static try<T, E = unknown>(callbackFn: () => T): Result<T, E> {
		return ResultImplementation.from(
			tryCatchFn(callbackFn) as ResultLike<T, E>,
		);
	}

	static all<const T extends readonly ResultLike<any, any>[]>(
		results: T,
	): Result<ExtractOkResultValues<T>, ExtractErrorResultValue<T>> {
		const values = [] as unknown as ExtractOkResultValues<T>;

		for (const result of results) {
			if (!result.ok) {
				return ResultImplementation.error(result.error) as Result<
					never,
					ExtractErrorResultValue<T>
				>;
			}

			values.push(result.value);
		}

		return ResultImplementation.ok(values);
	}

	static from<T, E>(result: ResultLike<T, E>): Result<T, E> {
		return result.ok
			? ResultImplementation.ok(result.value)
			: ResultImplementation.error(result.error);
	}

	static isResult(value: unknown): value is Result<unknown, unknown> {
		return value instanceof ResultImplementation;
	}

	static get [Symbol.species]() {
		return ResultImplementation;
	}

	map<U>(callbackFn: (value: T) => U): Result<U, E> {
		return ResultImplementation.from(
			mapFn(this as unknown as Result<T, E>, callbackFn),
		);
	}

	flatMap<U, F = E>(
		callbackFn: (value: T) => AsyncResult<U, F>,
	): AsyncResult<U, F>;
	flatMap<U, F = E>(callbackFn: (value: T) => Result<U, F>): Result<U, F>;
	flatMap<U, F = E>(
		callbackFn: (value: T) => MaybeAsyncResult<U, F>,
	): MaybeAsyncResult<U, F> {
		const result = flatMapFn(
			this as unknown as Result<T, E>,
			callbackFn as unknown as (value: T) => MaybeAsyncResultLike<U, F>,
		) as MaybeAsyncResultLike<U, F>;

		if (isPromiseLike(result)) {
			return new AsyncResultImplementation<U, F>(
				(okCallback, errCallback) => {
					result.then((r) => {
						matchFn(r, okCallback, (err) => errCallback(err as F));
					});
				},
			);
		}
		return ResultImplementation.from(result);
	}

	mapError<F>(callbackFn: (error: E) => F): Result<T, F> {
		return ResultImplementation.from(
			mapErrorFn(this as unknown as Result<T, E>, callbackFn),
		);
	}

	flatMapError<U, F = E>(
		callbackFn: (error: E) => PromiseLike<Result<U, F>>,
	): AsyncResult<T | U, F>;
	flatMapError<U, F = E>(
		callbackFn: (error: E) => Result<U, F>,
	): Result<T | U, F>;
	flatMapError<U, F = E>(
		callbackFn: (error: E) => Result<U, F> | PromiseLike<Result<U, F>>,
	): Result<T | U, F> | AsyncResult<T | U, F> {
		const result = flatMapErrorFn(
			this as unknown as Result<T, E>,
			callbackFn as unknown as (error: E) => MaybeAsyncResultLike<U, F>,
		) as MaybeAsyncResultLike<T | U, F>;

		if (isPromiseLike(result)) {
			return new AsyncResultImplementation<T | U, F>(
				(okCallback, errCallback) => {
					result.then(matchFn(okCallback, errCallback));
				},
			);
		}

		return ResultImplementation.from(result);
	}

	catch<U>(callbackFn: (error: E) => U): Result<T | U, never> {
		return ResultImplementation.from(
			catchErrorFn(this as unknown as Result<T, E>, callbackFn),
		);
	}

	tap(onOk: (value: T) => void): Result<T, E> {
		return ResultImplementation.from(
			tapFn(this as unknown as Result<T, E>, onOk as (value: T) => void),
		);
	}

	tapError(onError: (error: E) => void): Result<T, E> {
		return ResultImplementation.from(
			tapErrorFn(
				this as unknown as Result<T, E>,
				onError as (error: E) => void,
			),
		);
	}

	finally(onFinally: () => void): Result<T, E> {
		return ResultImplementation.from(
			tapBothFn(this as unknown as Result<T, E>, onFinally),
		);
	}

	match<TValue, TError>(
		onOk: (value: T) => TValue,
		onError: (error: E) => TError,
	): TValue | TError {
		return matchFn(this as unknown as Result<T, E>, onOk, onError);
	}

	get [Symbol.toStringTag](): 'Result' {
		return 'Result';
	}
}

// AsyncResult implementation

class AsyncResultImplementation<T, E = unknown> implements AsyncResult<T, E> {
	private _promise: Promise<Result<T, E>>;

	constructor(
		executor: (ok: (value: T) => void, err: (error: E) => void) => void,
	) {
		this._promise = new Promise((resolve) => {
			executor(
				(value) => resolve(ResultImplementation.ok(value)),
				(error) => resolve(ResultImplementation.error(error)),
			);
		});
	}

	static ok<T>(value: T): AsyncResult<T, never> {
		return new AsyncResultImplementation<T, never>((ok) => ok(value));
	}

	static error<E>(error: E): AsyncResult<never, E> {
		return new AsyncResultImplementation<never, E>((_, err) => err(error));
	}

	static try<T, F = unknown>(
		callbackFn: () => T | PromiseLike<T>,
		onError?: (e: unknown) => F,
	): AsyncResult<T, F> {
		const out = tryCatchFn(
			callbackFn,
			onError as (e: unknown) => F,
		) as MaybeAsyncResultLike<T, F>;
		return AsyncResultImplementation.from(out);
	}

	static all(iterable: readonly any[]): AsyncResult<any, any> {
		return AsyncResultImplementation.from(
			allFn(iterable as readonly MaybeAsyncResultLike<any, any>[]),
		);
	}

	static from<T, E = unknown>(
		result: MaybeAsyncResultLike<T, E>,
	): AsyncResult<T, E> {
		return new AsyncResultImplementation<T, E>((ok, err) => {
			Promise.resolve(result).then(
				(r) => (r.ok ? ok(r.value) : err(r.error)),
				() => {},
			);
		});
	}

	static fromPromise<T, E = unknown>(
		promise: Promise<T>,
		onError?: (reason: unknown) => E,
	): AsyncResult<T, E> {
		return new AsyncResultImplementation<T, E>((ok, err) => {
			promise.then(
				(value) => ok(value),
				(reason) => err(onError ? onError(reason) : (reason as E)),
			);
		});
	}

	static isAsyncResult(
		asyncResult: unknown,
	): asyncResult is AsyncResult<unknown, unknown> {
		return asyncResult instanceof AsyncResultImplementation;
	}

	static get [Symbol.species]() {
		return AsyncResultImplementation;
	}

	then<TResult1 = Result<T, E>, TResult2 = never>(
		onfulfilled?:
			| ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
			| null,
		onrejected?:
			| ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
			| null,
	): PromiseLike<TResult1 | TResult2> {
		return this._promise.then(onfulfilled, onrejected);
	}

	map<U>(callbackFn: (value: T) => U | PromiseLike<U>): AsyncResult<U, E> {
		return new AsyncResultImplementation<U, E>((ok, err) => {
			this._promise.then((result) => {
				if (!result.ok) {
					return err(result.error);
				}

				Promise.resolve(callbackFn(result.value)).then(ok);
			});
		});
	}

	flatMap<U, F = E>(
		callbackFn: (value: T) => Result<U, F> | AsyncResult<U, F>,
	): AsyncResult<U, E | F> {
		return new AsyncResultImplementation<U, E | F>((ok, err) => {
			this._promise.then((result) => {
				if (!result.ok) {
					err(result.error);
					return;
				}

				const next = callbackFn(result.value);

				if (AsyncResultImplementation.isAsyncResult(next)) {
					next.then((innerResult) => {
						if (!innerResult.ok) {
							err(innerResult.error);
							return;
						}

						ok(innerResult.value);
						return;
					});
					return;
				}

				if (ResultImplementation.isResult(next)) {
					if (!next.ok) {
						err(next.error);
						return;
					}

					ok(next.value);
					return;
				}
			});
		});
	}

	mapError<F>(
		callbackFn: (error: E) => F | PromiseLike<F>,
	): AsyncResult<T, F> {
		return new AsyncResultImplementation<T, F>((ok, err) => {
			this._promise.then((result) => {
				if (!result.ok) {
					Promise.resolve(callbackFn(result.error)).then(err);
					return;
				}

				ok(result.value);
			});
		});
	}

	flatMapError<U, F = E>(
		callbackFn: (error: E) => Result<U, F> | AsyncResult<U, F>,
	): AsyncResult<T | U, F> {
		return new AsyncResultImplementation<T | U, F>((ok, err) => {
			this._promise.then((result) => {
				if (result.ok) {
					ok(result.value);
					return;
				}

				const next = callbackFn(result.error);

				if (AsyncResultImplementation.isAsyncResult(next)) {
					next.then((innerResult) => {
						if (!innerResult.ok) {
							err(innerResult.error);
							return;
						}
						ok(innerResult.value);
					});

					return;
				}

				if (ResultImplementation.isResult(next)) {
					if (!next.ok) {
						err(next.error);
						return;
					}

					ok(next.value);
					return;
				}
			});
		});
	}

	catch<U>(
		callbackFn: (error: E) => U | PromiseLike<U>,
	): AsyncResult<T | U, never> {
		return new AsyncResultImplementation<T | U, never>((ok) => {
			this._promise.then((result) => {
				if (result.ok) {
					return ok(result.value);
				}

				Promise.resolve(callbackFn(result.error)).then(ok);
			});
		});
	}

	tap(onOk: (value: T) => void | PromiseLike<void>): AsyncResult<T, E> {
		return new AsyncResultImplementation<T, E>((ok, err) => {
			this._promise.then((result) => {
				if (!result.ok) {
					err(result.error);
					return;
				}

				Promise.resolve(onOk(result.value)).then(() =>
					ok(result.value),
				);
			});
		});
	}

	tapError(
		onError: (error: E) => void | PromiseLike<void>,
	): AsyncResult<T, E> {
		return new AsyncResultImplementation<T, E>((ok, err) => {
			this._promise.then((result) => {
				if (result.ok) {
					ok(result.value);
					return;
				}

				Promise.resolve(onError(result.error)).then(() =>
					err(result.error),
				);
			});
		});
	}

	finally(onFinally: () => void | PromiseLike<void>): AsyncResult<T, E> {
		return new AsyncResultImplementation<T, E>((ok, err) => {
			this._promise.finally(onFinally).then((result) => {
				if (result.ok) {
					ok(result.value);
					return;
				}

				err(result.error);
			});
		});
	}

	match<TValue, TError>(
		onOk: (value: T) => TValue | PromiseLike<TValue>,
		onError: (error: E) => TError | PromiseLike<TError>,
	): Promise<TValue | TError> {
		return this._promise.then(async (result): Promise<TValue | TError> => {
			if (!result.ok) {
				return await Promise.resolve(onError(result.error));
			}

			return await Promise.resolve(onOk(result.value));
		});
	}

	get [Symbol.toStringTag](): 'AsyncResult' {
		return 'AsyncResult';
	}
}

export const Result: ResultConstructor =
	ResultImplementation as unknown as ResultConstructor;
export const AsyncResult: AsyncResultConstructor = AsyncResultImplementation;
