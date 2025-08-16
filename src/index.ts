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
	from as fromFn,
	fromPromise as fromPromiseFn,
	type Result as ResultLike,
	type MaybeAsyncResult as MaybeAsyncResultLike,
	type ResolveOkValue,
	type ResolveErrorValue,
} from './core/index.js';
import { isPromiseLike } from './core/internal.js';

// Type utilities

type NotPromiseLike<T> = T extends PromiseLike<any> ? never : T;

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

function wrapFn<F extends (...args: any[]) => any, E = unknown>(
	fn: F,
	mapError?: (e: unknown) => E,
) {
	return (...args: Parameters<F>) => {
		try {
			const out = fn(...args);
			if (isPromiseLike(out)) {
				return AsyncResultImplementation.from(
					Promise.resolve(out).then(
						(v) => ResultImplementation.ok(v),
						(e) =>
							ResultImplementation.error(
								mapError ? mapError(e) : e,
							),
					),
				);
			}
			return ResultImplementation.ok(out);
		} catch (e) {
			return ResultImplementation.error(mapError ? mapError(e) : e);
		}
	};
}

export interface ResultPrototype<T, E> {
	map<U>(callbackFn: (value: T) => PromiseLike<U>): AsyncResult<U, E>;
	map<U>(callbackFn: (value: T) => U): Result<U, E>;

	flatMap<U, F = E>(
		callbackFn: (value: T) => PromiseLike<Result<U, F>>,
	): AsyncResult<U, E | F>;
	flatMap<U, F = E>(callbackFn: (value: T) => Result<U, F>): Result<U, E | F>;

	mapError<F>(callbackFn: (error: E) => PromiseLike<F>): AsyncResult<T, F>;
	mapError<F>(callbackFn: (error: E) => F): Result<T, F>;

	flatMapError<U, F = E>(
		callbackFn: (error: E) => PromiseLike<Result<U, F>>,
	): AsyncResult<T | U, F>;

	flatMapError<U, F = E>(
		callbackFn: (error: E) => Result<U, F>,
	): Result<T | U, F>;

	catch<U>(
		callbackFn: (error: E) => PromiseLike<U>,
	): AsyncResult<T | U, never>;
	catch<U>(callbackFn: (error: E) => U): Result<T | U, never>;

	tap(onOk: (value: T) => PromiseLike<unknown>): AsyncResult<T, E>;
	tap(onOk: (value: T) => unknown): Result<T, E>;

	tapError(onError: (error: E) => PromiseLike<unknown>): AsyncResult<T, E>;
	tapError(onError: (error: E) => unknown): Result<T, E>;

	finally(
		onFinally: (result: Result<T, E>) => PromiseLike<unknown>,
	): AsyncResult<T, E>;
	finally(onFinally: (result: Result<T, E>) => unknown): Result<T, E>;

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

	wrap<F extends (...args: any[]) => PromiseLike<any>, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	): (...args: Parameters<F>) => AsyncResult<Awaited<ReturnType<F>>, E>;
	wrap<F extends (...args: any[]) => never, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	): (...args: Parameters<F>) => Result<never, E>;
	wrap<F extends (...args: any[]) => any, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	): (...args: Parameters<F>) => Result<ReturnType<F>, E>;

	all<const T extends readonly ResultLike<any, any>[]>(
		results: T,
	): Result<ExtractOkResultValues<T>, ExtractErrorResultValue<T>>;

	from<T, E = unknown>(result: ResultLike<T, E>): Result<T, E>;

	fromPromise<T, E = unknown>(
		promise: Promise<T>,
		onError?: (reason: unknown) => E,
	): AsyncResult<T, E>;

	isResult(result: unknown): result is Result<unknown, unknown>;

	wrap<F extends (...args: any[]) => never, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	): (...args: Parameters<F>) => Result<never, E>;
	wrap<F extends (...args: any[]) => PromiseLike<any>, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	): (...args: Parameters<F>) => AsyncResult<Awaited<ReturnType<F>>, E>;
	wrap<F extends (...args: any[]) => any, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	): (...args: Parameters<F>) => Result<ReturnType<F>, E>;

	readonly [Symbol.species]: ResultConstructor;

	readonly prototype: Result<unknown, unknown>;
}

// AsyncResult types

export interface AsyncResultPrototype<T, E> {
	map<U>(callbackFn: (value: T) => U | PromiseLike<U>): AsyncResult<U, E>;

	flatMap<U, F = E>(
		callbackFn: (value: T) => Result<U, F> | PromiseLike<Result<U, F>>,
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
		onError: (error: E) => unknown | PromiseLike<unknown>,
	): AsyncResult<T, E>;

	finally(onFinally: () => void | PromiseLike<void>): AsyncResult<T, E>;

	match<TValue, TError>(
		onOk: (value: T) => TValue,
		onError: (error: E) => TError,
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

	wrap<F extends (...args: any[]) => PromiseLike<any>, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	): (...args: Parameters<F>) => AsyncResult<Awaited<ReturnType<F>>, E>;
	wrap<F extends (...args: any[]) => never, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	): (...args: Parameters<F>) => Result<never, E>;
	wrap<F extends (...args: any[]) => any, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	): (...args: Parameters<F>) => Result<ReturnType<F>, E>;

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

	static try<T>(callbackFn: () => PromiseLike<T>): AsyncResult<T, unknown>;
	static try<T>(callbackFn: () => T): Result<T, unknown>;
	static try<T, F>(
		callbackFn: () => PromiseLike<T>,
		onError: (e: unknown) => F,
	): AsyncResult<T, F>;
	static try<T, F>(
		callbackFn: () => T,
		onError: (e: unknown) => F,
	): Result<T, F>;
	static try<T, F = unknown>(
		fn: () => T | PromiseLike<T>,
		onError?: (e: unknown) => F,
	): MaybeAsyncResult<T, F> {
		const out = tryCatchFn(
			fn,
			onError as (e: unknown) => F,
		) as MaybeAsyncResultLike<T, F>;

		if (isPromiseLike(out)) {
			return AsyncResultImplementation.from(out);
		}

		return ResultImplementation.from(out);
	}

	static wrap<F extends (...args: any[]) => any, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	) {
		return wrapFn(fn, mapError);
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

	static fromPromise<T, E = unknown>(
		promise: Promise<T>,
		onError?: (reason: unknown) => E,
	): AsyncResult<T, E> {
		return AsyncResultImplementation.from(fromPromiseFn(promise, onError));
	}

	static isResult(value: unknown): value is Result<unknown, unknown> {
		return value instanceof ResultImplementation;
	}

	static get [Symbol.species]() {
		return ResultImplementation;
	}

	map<U>(callbackFn: (value: T) => PromiseLike<U>): AsyncResult<U, E>;
	map<U>(callbackFn: (value: T) => U): Result<U, E>;
	map<U>(
		callbackFn: (value: T) => U | PromiseLike<U>,
	): MaybeAsyncResult<U, E> {
		const result = mapFn(this as Result<T, E>, callbackFn);

		if (isPromiseLike(result)) {
			return AsyncResultImplementation.from(result);
		}

		return ResultImplementation.from(result);
	}

	flatMap<U, F = E>(
		callbackFn: (value: T) => AsyncResult<U, F>,
	): AsyncResult<U, F>;
	flatMap<U, F = E>(callbackFn: (value: T) => Result<U, F>): Result<U, F>;
	flatMap<U, F = E>(
		callbackFn: (value: T) => MaybeAsyncResult<U, F>,
	): MaybeAsyncResult<U, F> {
		const result = flatMapFn(
			this as Result<T, E>,
			callbackFn as (value: T) => MaybeAsyncResultLike<U, F>,
		) as MaybeAsyncResultLike<U, F>;

		if (isPromiseLike(result)) {
			return AsyncResultImplementation.from(result);
		}

		return ResultImplementation.from(result);
	}

	mapError<F>(
		callbackFn: (error: E) => NotPromiseLike<F>,
	): [E] extends [never] ? Result<T, never> : Result<T, F>;
	mapError<F>(callbackFn: (error: E) => PromiseLike<F>): AsyncResult<T, F>;
	mapError<F>(
		callbackFn: (error: E) => F | PromiseLike<F>,
	): MaybeAsyncResult<T, F> {
		const result = mapErrorFn(this as Result<T, E>, callbackFn);

		if (isPromiseLike(result)) {
			return AsyncResultImplementation.from(result);
		}

		return ResultImplementation.from(result);
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
			this as Result<T, E>,
			callbackFn as (error: E) => MaybeAsyncResultLike<U, F>,
		);

		if (isPromiseLike(result)) {
			return AsyncResultImplementation.from(result);
		}

		return ResultImplementation.from(result);
	}

	catch<U>(
		callbackFn: (error: E) => PromiseLike<U>,
	): AsyncResult<T | U, never>;
	catch<U>(callbackFn: (error: E) => U): Result<T | U, never>;
	catch<U>(
		callbackFn: (error: E) => U | PromiseLike<U>,
	): MaybeAsyncResult<T | U, never> {
		const result = catchErrorFn(this as Result<T, E>, callbackFn);

		if (isPromiseLike(result)) {
			return AsyncResultImplementation.from(result);
		}

		return ResultImplementation.from(result);
	}

	tap(onOk: (value: T) => unknown | PromiseLike<unknown>): AsyncResult<T, E>;
	tap(onOk: (value: T) => unknown): Result<T, E>;
	tap(
		onOk: (value: T) => unknown | PromiseLike<unknown>,
	): MaybeAsyncResult<T, E> {
		const result = tapFn(this as Result<T, E>, onOk);

		if (isPromiseLike(result)) {
			return AsyncResultImplementation.from(result);
		}

		return ResultImplementation.from(result);
	}

	tapError(
		onError: (error: E) => unknown | PromiseLike<unknown>,
	): AsyncResult<T, E>;
	tapError(onError: (error: E) => unknown): Result<T, E>;
	tapError(
		onError: (error: E) => unknown | PromiseLike<unknown>,
	): MaybeAsyncResult<T, E> {
		const result = tapErrorFn(this as Result<T, E>, onError);

		if (isPromiseLike(result)) {
			return AsyncResultImplementation.from(result);
		}

		return ResultImplementation.from(result);
	}

	finally(
		onFinally: (result: Result<T, E>) => unknown | PromiseLike<unknown>,
	): AsyncResult<T, E>;
	finally(onFinally: (result: Result<T, E>) => unknown): Result<T, E>;
	finally(
		onFinally: (result: Result<T, E>) => unknown | PromiseLike<unknown>,
	): MaybeAsyncResult<T, E> {
		const result = tapBothFn(
			this as Result<T, E>,
			onFinally,
		) as MaybeAsyncResultLike<T, E>;

		if (isPromiseLike(result)) {
			return AsyncResultImplementation.from(result);
		}

		return ResultImplementation.from(result);
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

	toJSON(): ResultLikeInternal<T, E> {
		return fromFn(this as unknown as Result<T, E>);
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

	static wrap<F extends (...args: any[]) => any, E = unknown>(
		fn: F,
		mapError?: (e: unknown) => E,
	) {
		return wrapFn(fn, mapError);
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
			Promise.resolve(result).then((r) =>
				r.ok ? ok(r.value) : err(r.error),
			);
		});
	}

	static fromPromise<T, E = unknown>(
		promise: Promise<T>,
		onError?: (reason: unknown) => E,
	): AsyncResult<T, E> {
		return AsyncResultImplementation.from(fromPromiseFn(promise, onError));
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
		return AsyncResultImplementation.from(
			mapFn(this._promise, callbackFn) as ResultLike<U, E>,
		);
	}

	flatMap<U, F = E>(
		callbackFn: (value: T) => Result<U, F> | AsyncResult<U, F>,
	): AsyncResult<U, E | F> {
		return AsyncResultImplementation.from(
			flatMapFn(this._promise, callbackFn as any),
		);
	}

	mapError<F>(
		callbackFn: (error: E) => F | PromiseLike<F>,
	): AsyncResult<T, F> {
		return AsyncResultImplementation.from(
			mapErrorFn(this._promise, callbackFn),
		);
	}

	flatMapError<U, F = E>(
		callbackFn: (error: E) => Result<U, F> | AsyncResult<U, F>,
	): AsyncResult<T | U, F> {
		return AsyncResultImplementation.from(
			flatMapErrorFn(this._promise, callbackFn as any),
		);
	}

	catch<U>(
		callbackFn: (error: E) => U | PromiseLike<U>,
	): AsyncResult<T | U, never> {
		return AsyncResultImplementation.from(
			catchErrorFn(this._promise, callbackFn),
		);
	}

	tap(onOk: (value: T) => void | PromiseLike<void>): AsyncResult<T, E> {
		return AsyncResultImplementation.from(tapFn(this._promise, onOk));
	}

	tapError(
		onError: (error: E) => void | PromiseLike<void>,
	): AsyncResult<T, E> {
		return AsyncResultImplementation.from(
			tapErrorFn(this._promise, onError),
		);
	}

	finally(
		onFinally: (result: AsyncResult<T, E>) => void | PromiseLike<void>,
	): AsyncResult<T, E> {
		return AsyncResultImplementation.from(
			tapBothFn(
				this._promise,
				onFinally as unknown as (
					result: MaybeAsyncResultLike<T, E>,
				) => void | PromiseLike<void>,
			),
		);
	}

	match<TValue, TError>(
		onOk: (value: T) => TValue,
		onError: (error: E) => TError,
	): Promise<TValue | TError> {
		return this._promise.then(matchFn(onOk, onError));
	}

	get [Symbol.toStringTag](): 'AsyncResult' {
		return 'AsyncResult';
	}
}

export const Result: ResultConstructor =
	ResultImplementation as unknown as ResultConstructor;
export const AsyncResult: AsyncResultConstructor =
	AsyncResultImplementation as unknown as AsyncResultConstructor;
