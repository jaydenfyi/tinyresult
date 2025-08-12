import { dual, isPromiseLike } from './internal.js';

export { pipe } from './pipe.js';

export interface OkResult<T> {
	readonly ok: true;
	readonly value: T;
}

export interface ErrorResult<E> {
	readonly ok: false;
	readonly error: E;
}

export type Result<T, E = unknown> = OkResult<T> | ErrorResult<E>;
export type AsyncResult<T, E = unknown> = Promise<Result<T, E>>;
export type MaybeAsyncResult<T, E = unknown> = Result<T, E> | AsyncResult<T, E>;

type ResolveResult<R> =
	R extends PromiseLike<infer P>
		? P extends Result<any, any>
			? P
			: never
		: R extends Result<any, any>
			? R
			: never;

export type ResolveOkValue<R> =
	ResolveResult<R> extends Result<infer T, any> ? T : never;
export type ResolveErrorValue<R> =
	ResolveResult<R> extends Result<any, infer E> ? E : never;

type AnyAsync<Args extends readonly unknown[]> =
	Extract<Args[number], PromiseLike<any>> extends never ? false : true;

type ResultFor<Args extends readonly unknown[], T, E> =
	AnyAsync<Args> extends true ? AsyncResult<T, E> : Result<T, E>;

export type ExtractOkResultValues<
	R extends readonly MaybeAsyncResult<any, any>[],
> = {
	-readonly [K in keyof R]: ResolveOkValue<R[K]>;
};

export type ExtractErrorResultValue<
	R extends readonly MaybeAsyncResult<any, any>[],
> = ResolveErrorValue<R[number]>;

export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

export function error<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

export function from<R extends AsyncResult<any, any>>(
	result: R,
): AsyncResult<ResolveOkValue<R>, ResolveErrorValue<R>>;
export function from<R extends Result<any, any>>(
	result: R,
): Result<ResolveOkValue<R>, ResolveErrorValue<R>>;
export function from<R extends MaybeAsyncResult<any, any>>(
	result: R,
): MaybeAsyncResult<ResolveOkValue<R>, ResolveErrorValue<R>> {
	if (isPromiseLike(result)) {
		return Promise.resolve(
			(result as PromiseLike<Result<any, any>>).then(from),
		);
	}

	return (result as Result<any, any>).ok
		? ok((result as OkResult<any>).value)
		: error((result as ErrorResult<any>).error);
}

export function isResult(value: unknown): value is Result<unknown, unknown> {
	return (
		!!value &&
		typeof value === 'object' &&
		'ok' in (value as any) &&
		(((value as any).ok === true && 'value' in (value as any)) ||
			((value as any).ok === false && 'error' in (value as any)))
	);
}

export function tryCatch<T>(fn: () => PromiseLike<T>): AsyncResult<T, unknown>;
export function tryCatch<T>(fn: () => T): Result<T, unknown>;
export function tryCatch<T, F>(
	fn: () => PromiseLike<T>,
	onError: (e: unknown) => F,
): AsyncResult<T, F>;
export function tryCatch<T, F>(
	fn: () => T,
	onError: (e: unknown) => F,
): Result<T, F>;
export function tryCatch<T, F = unknown>(
	fn: () => T | PromiseLike<T>,
	onError?: (e: unknown) => F,
): MaybeAsyncResult<T, F> {
	try {
		const out = fn();
		if (isPromiseLike(out)) {
			return Promise.resolve(out as PromiseLike<T>).then(
				(v) => ok<T>(v),
				(e) => error<F>(onError ? onError(e) : (e as unknown as F)),
			);
		}

		return ok<T>(out as T);
	} catch (e) {
		return error<F>(onError ? onError(e) : (e as unknown as F));
	}
}

export { tryCatch as try };

type HasAsync<R extends readonly unknown[]> =
	Extract<R[number], PromiseLike<any>> extends never ? false : true;

type RewrapArray<R extends readonly MaybeAsyncResult<any, any>[], T, E> =
	HasAsync<R> extends true ? AsyncResult<T, E> : Result<T, E>;

export function all<R extends readonly MaybeAsyncResult<any, any>[]>(
	results: R,
): RewrapArray<R, ExtractOkResultValues<R>, ExtractErrorResultValue<R>> {
	const hasAsync = results.some(isPromiseLike);
	if (!hasAsync) {
		const values: any[] = [];
		for (const r of results as readonly Result<any, any>[]) {
			if (!r.ok) return error(r.error) as any;
			values.push(r.value);
		}

		return ok(values) as any;
	}

	return Promise.all(results).then((resolved) => {
		const values: any[] = [];
		for (const r of resolved) {
			if (!r.ok) return error(r.error);
			values.push(r.value);
		}

		return ok(values);
	}) as any;
}

/** ── dual versions ───────────────────────────────────────────────────────── */

/**
 * Maps the `Ok` value of a `Result`. If the input is an `AsyncResult`, the output is an `AsyncResult`.
 *
 * Data-last overload: given `fn`, returns a function that accepts either sync or async `Result`.
 *   Input: R (maybe async), Mapper: (Ok<R>) -> U
 *   Output: Result<U, Error<R>> (async iff R is async)
 *
 * Data-first overload: given `result` (maybe async) and `fn`.
 *   Input: R (maybe async), Mapper: (Ok<R>) -> U
 *   Output: Result<U, Error<R>> (async iff R is async)
 */
export const map: {
	// data-last
	<R extends MaybeAsyncResult<any, any>, U>(
		fn: (v: ResolveOkValue<R>) => U,
	): (result: R) => ResultFor<[R], U, ResolveErrorValue<R>>;

	// data-first
	<R extends MaybeAsyncResult<any, any>, U>(
		result: R,
		fn: (v: ResolveOkValue<R>) => U,
	): ResultFor<[R], U, ResolveErrorValue<R>>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (v: any) => any): any => {
	if (isPromiseLike(result)) {
		return result.then(map(fn));
	}

	return result.ok ? ok(fn(result.value)) : error(result.error);
});

/**
 * Maps the `Ok` value of a `Result` to a new `Result`. The output is async if either:
 *   - the input is async OR
 *   - the mapping function returns an `AsyncResult`.
 *
 * Data-last overload:
 *   Input: R (maybe async)
 *   Mapper: (Ok<R>) -> RF (maybe async Result)
 *   Output: Result<Ok<RF>, Error<R> | Error<RF>> (async iff R or RF is async)
 *
 * Data-first overload:
 *   Same as above but with `(result, fn)` order.
 */
export const flatMap: {
	// data-last
	<
		R extends MaybeAsyncResult<any, any>,
		RF extends MaybeAsyncResult<any, any>,
	>(
		fn: (v: ResolveOkValue<R>) => RF,
	): (
		result: R,
	) => ResultFor<
		[R, RF],
		ResolveOkValue<RF>,
		ResolveErrorValue<R> | ResolveErrorValue<RF>
	>;

	// data-first
	<
		R extends MaybeAsyncResult<any, any>,
		RF extends MaybeAsyncResult<any, any>,
	>(
		result: R,
		fn: (v: ResolveOkValue<R>) => RF,
	): ResultFor<
		[R, RF],
		ResolveOkValue<RF>,
		ResolveErrorValue<R> | ResolveErrorValue<RF>
	>;
} = dual(
	2,
	(
		result: MaybeAsyncResult<any, any>,
		fn: (v: any) => MaybeAsyncResult<any, any>,
	): any => {
		if (isPromiseLike(result)) {
			return result.then(flatMap(fn));
		}

		return result.ok ? fn(result.value) : error(result.error);
	},
);

/**
 * Maps the `Error` value of a `Result`. If the input is an `AsyncResult`, the output is an `AsyncResult`.
 *
 * Data-last overload:
 *   Input: R (maybe async), Mapper: (Error<R>) -> F
 *   Output: Result<Ok<R>, F> (async iff R is async)
 *
 * Data-first overload:
 *   Same as above but with `(result, fn)` order.
 */
export const mapError: {
	// data-last
	<R extends MaybeAsyncResult<any, any>, F>(
		fn: (e: ResolveErrorValue<R>) => F,
	): (result: R) => ResultFor<[R], ResolveOkValue<R>, F>;

	// data-first
	<R extends MaybeAsyncResult<any, any>, F>(
		result: R,
		fn: (e: ResolveErrorValue<R>) => F,
	): ResultFor<[R], ResolveOkValue<R>, F>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (e: any) => any): any => {
	if (isPromiseLike(result)) {
		return result.then(mapError(fn));
	}

	return result.ok ? ok(result.value) : error(fn(result.error));
});

/**
 * Maps the `Error` value of a `Result` to a new `Result`. The output is async if either:
 *   - the input is async OR
 *   - the mapping function returns an `AsyncResult`.
 *
 * Data-last overload:
 *   Input: R (maybe async)
 *   Mapper: (Error<R>) -> RF (maybe async Result)
 *   Output: Result<Ok<R> | Ok<RF>, Error<RF>> (async iff R or RF is async)
 *
 * Data-first overload:
 *   Same as above but with `(result, fn)` order.
 */
export const flatMapError: {
	// data-last
	<
		R extends MaybeAsyncResult<any, any>,
		RF extends MaybeAsyncResult<any, any>,
	>(
		fn: (e: ResolveErrorValue<R>) => RF,
	): (
		result: R,
	) => ResultFor<
		[R, RF],
		ResolveOkValue<RF> | ResolveOkValue<R>,
		ResolveErrorValue<RF>
	>;

	// data-first
	<
		R extends MaybeAsyncResult<any, any>,
		RF extends MaybeAsyncResult<any, any>,
	>(
		result: R,
		fn: (e: ResolveErrorValue<R>) => RF,
	): ResultFor<
		[R, RF],
		ResolveOkValue<RF> | ResolveOkValue<R>,
		ResolveErrorValue<RF>
	>;
} = dual(
	2,
	(
		result: MaybeAsyncResult<any, any>,
		fn: (e: any) => MaybeAsyncResult<any, any>,
	): any => {
		if (isPromiseLike(result)) {
			return result.then(flatMapError(fn));
		}

		return result.ok ? ok(result.value) : fn(result.error);
	},
);

/**
 * Recovers from an `Error` by mapping it to a new `Ok` value.
 * Output is async iff input is async.
 *
 * Data-last overload:
 *   Input: R (maybe async)
 *   Mapper: (Error<R>) -> U
 *   Output: Result<Ok<R> | U, never> (async iff R is async)
 *
 * Data-first overload:
 *   Same as above but with `(result, fn)` order.
 */
export const catchError: {
	// data-last
	<R extends MaybeAsyncResult<any, any>, U>(
		fn: (e: ResolveErrorValue<R>) => U,
	): (result: R) => ResultFor<[R], ResolveOkValue<R> | U, never>;

	// data-first
	<R extends MaybeAsyncResult<any, any>, U>(
		result: R,
		fn: (e: ResolveErrorValue<R>) => U,
	): ResultFor<[R], ResolveOkValue<R> | U, never>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (e: any) => any): any => {
	if (isPromiseLike(result)) {
		return result.then(catchError(fn));
	}

	return result.ok ? ok(result.value) : ok(fn(result.error));
});

export { catchError as catch };

/**
 * Performs a side-effect with the `Ok` value, returning the original `Result` unchanged.
 * Works for both sync and async transparently.
 */
export const tap: {
	<R extends MaybeAsyncResult<any, any>>(
		onOk: (v: ResolveOkValue<R>) => void,
	): (result: R) => R;
	<R extends MaybeAsyncResult<any, any>>(
		result: R,
		onOk: (v: ResolveOkValue<R>) => void,
	): R;
} = dual(
	2,
	(result: MaybeAsyncResult<any, any>, onOk: (v: any) => void): any => {
		if (isPromiseLike(result)) {
			return result.then(tap(onOk));
		}

		if (result.ok) {
			onOk(result.value);
		}

		return result;
	},
);

/**
 * Performs a side-effect with the `Error` value, returning the original `Result` unchanged.
 * Works for both sync and async transparently.
 */
export const tapError: {
	<R extends MaybeAsyncResult<any, any>>(
		onError: (e: ResolveErrorValue<R>) => void,
	): (result: R) => R;
	<R extends MaybeAsyncResult<any, any>>(
		result: R,
		onError: (e: ResolveErrorValue<R>) => void,
	): R;
} = dual(
	2,
	(result: MaybeAsyncResult<any, any>, onError: (e: any) => void): any => {
		if (isPromiseLike(result)) {
			return result.then(tapError(onError));
		}

		if (!result.ok) {
			onError(result.error);
		}

		return result;
	},
);

/**
 * Performs a side-effect on a `Result` (Ok or Error), returning the original `Result` unchanged.
 * Works for both sync and async transparently.
 */
export const tapBoth: {
	<R extends MaybeAsyncResult<any, any>>(
		onFinally: (r: ResolveResult<R>) => void,
	): (result: R) => R;
	<R extends MaybeAsyncResult<any, any>>(
		result: R,
		onFinally: (r: ResolveResult<R>) => void,
	): R;
} = dual(
	2,
	(result: MaybeAsyncResult<any, any>, onFinally: (r: any) => void): any => {
		if (isPromiseLike(result)) {
			return result.then(tapBoth(onFinally));
		}

		onFinally(result);

		return result;
	},
);

/**
 * Unwraps a `Result` by providing handlers for Ok and Error.
 * If the input is async, returns a PromiseLike of the union of handler outputs.
 */
type MatchReturn<R, V> = R extends PromiseLike<any> ? PromiseLike<V> : V;

export const match: {
	// data-last
	<R extends MaybeAsyncResult<any, any>, TValue, TError>(
		onOk: (v: ResolveOkValue<R>) => TValue,
		onError: (e: ResolveErrorValue<R>) => TError,
	): (result: R) => MatchReturn<R, TValue | TError>;

	// data-first
	<R extends MaybeAsyncResult<any, any>, TValue, TError>(
		result: R,
		onOk: (v: ResolveOkValue<R>) => TValue,
		onError: (e: ResolveErrorValue<R>) => TError,
	): MatchReturn<R, TValue | TError>;
} = dual(
	3,
	(
		result: MaybeAsyncResult<any, any>,
		onOk: (v: any) => any,
		onError: (e: any) => any,
	): any => {
		if (isPromiseLike(result)) {
			return result.then(match(onOk, onError));
		}

		return result.ok ? onOk(result.value) : onError(result.error);
	},
);
