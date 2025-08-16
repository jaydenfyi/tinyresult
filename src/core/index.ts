import { dual, isPromiseLike } from './internal.js';

export { pipe } from './pipe.js';

interface OkResult<T> {
	readonly ok: true;
	readonly value: T;
}

interface ErrorResult<E> {
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

/**
 * Creates a `Result` with `ok: true` and the given value.
 * @param value Value to wrap.
 * @returns A successful `Result`.
 */
export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

/**
 * Creates a `Result` with `ok: false` and the given error.
 * @param error Error to wrap.
 * @returns A failed `Result`.
 */
export function error<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

/**
 * Creates a `Result` or `AsyncResult` from a ResultLike value.
 * @param result Value to convert.
 * @returns A `Result` or `AsyncResult`.
 */
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
		return result.then(from);
	}

	return (result as Result<any, any>).ok
		? ok((result as OkResult<any>).value)
		: error((result as ErrorResult<any>).error);
}

/**
 * Wraps a promise in an `AsyncResult`, mapping rejection to `Error`.
 * @param onError Optional function to map rejection reason.
 * @returns An `AsyncResult` for the promise.
 */
export function fromPromise<T, E = unknown>(
	promise: PromiseLike<T>,
	onError?: (reason: unknown) => E,
): AsyncResult<T, E> {
	return Promise.resolve(promise).then(
		(v) => ok<T>(v),
		(r) => error<E>(onError ? onError(r) : (r as E)),
	);
}

/**
 * Checks if a value is a `Result`.
 * @param value Value to check.
 * @returns `true` if the value is a `Result`.
 */
export function isResult(value: unknown): value is Result<unknown, unknown> {
	return (
		!!value &&
		typeof value === 'object' &&
		'ok' in (value as any) &&
		(((value as any).ok === true && 'value' in (value as any)) ||
			((value as any).ok === false && 'error' in (value as any)))
	);
}

/**
 * Runs a function and captures thrown errors or rejections in a `Result`.
 * @param fn Function to run.
 * @param onError Optional function to map errors.
 * @returns The function output as a `Result` or `AsyncResult`.
 */
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

/**
 * Wraps a function, returning a new function that yields a `Result`/`AsyncResult`.
 * Normal returns become `OkResult`; thrown/rejected errors become `ErrorResult` (optionally mapped).
 * @param fn Function to wrap.
 * @param mapError Optional mapper for a caught or rejected error.
 * @returns A function with the same parameters returning a `Result` or `AsyncResult`.
 */
export function wrap<F extends (...args: any[]) => never, E = unknown>(
	fn: F,
	mapError?: (e: unknown) => E,
): (...args: Parameters<F>) => Result<never, E>;
export function wrap<
	F extends (...args: any[]) => PromiseLike<any>,
	E = unknown,
>(
	fn: F,
	mapError?: (e: unknown) => E,
): (...args: Parameters<F>) => AsyncResult<Awaited<ReturnType<F>>, E>;
export function wrap<F extends (...args: any[]) => any, E = unknown>(
	fn: F,
	mapError?: (e: unknown) => E,
): (...args: Parameters<F>) => Result<ReturnType<F>, E>;
export function wrap(
	fn: (...args: any[]) => any,
	mapError?: (e: unknown) => unknown,
) {
	return (...args: any[]) => {
		try {
			const out = fn(...args);
			if (isPromiseLike(out)) {
				return Promise.resolve(out).then(
					(v) => ok(v),
					(e) => error(mapError ? mapError(e) : e),
				);
			}
			return ok(out);
		} catch (e) {
			return error(mapError ? mapError(e) : e);
		}
	};
}

type HasAsync<R extends readonly unknown[]> =
	Extract<R[number], PromiseLike<any>> extends never ? false : true;

type RewrapArray<R extends readonly MaybeAsyncResult<any, any>[], T, E> =
	HasAsync<R> extends true ? AsyncResult<T, E> : Result<T, E>;

/**
 * Maps the `OkResult` to a new value.
 * @param fn Mapper for the `OkResult`.
 * @returns A mapper (data-last) or the mapped `Result`/`AsyncResult` (data-first).
 */
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

	const values: any[] = new Array(results.length);
	return new Promise((resolve) => {
		let done = false;
		let pending = 0;

		for (let i = 0; i < results.length; i++) {
			const item = results[i];

			if (!isPromiseLike(item)) {
				const r = item as Result<any, any>;
				if (!r.ok) {
					if (done) continue;
					done = true;
					resolve(error(r.error) as any);
					continue;
				}
				values[i] = r.value;
				continue;
			}

			pending++;
			(item as Promise<Result<any, any>>).then((r) => {
				if (done) return;
				if (!r.ok) {
					done = true;
					resolve(error(r.error));
					return;
				}
				values[i] = r.value;
				pending--;
				if (!done && pending === 0) {
					done = true;
					resolve(ok(values) as any);
				}
			});
		}

		if (!done && pending === 0) {
			done = true;
			resolve(ok(values) as any);
		}
	}) as RewrapArray<R, ExtractOkResultValues<R>, ExtractErrorResultValue<R>>;
}

/** ── dual versions ───────────────────────────────────────────────────────── */

/**
 * Transforms the `OkResult` into another `Result`/`AsyncResult`.
 * @param fn Mapper from `OkResult` to `Result`/`AsyncResult`.
 * @returns A mapper (data-last) or the chained `Result`/`AsyncResult` (data-first).
 */
export const map: {
	// data-last
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (v: ResolveOkValue<R>) => any,
	>(
		fn: F,
	): (
		result: R,
	) => ResultFor<
		[R, ReturnType<F>],
		Awaited<ReturnType<F>>,
		ResolveErrorValue<R>
	>;

	// data-first
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (v: ResolveOkValue<R>) => any,
	>(
		result: R,
		fn: F,
	): ResultFor<
		[R, ReturnType<F>],
		Awaited<ReturnType<F>>,
		ResolveErrorValue<R>
	>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (v: any) => any): any => {
	if (isPromiseLike(result)) return result.then(map(fn));
	if (!result.ok) return error(result.error);

	const out = fn(result.value);
	if (isPromiseLike(out)) return out.then(ok);
	return ok(out);
});

/**
 * Transforms the `OkResult` into another `Result`/`AsyncResult`.
 * @param fn Mapper from `OkResult` to `Result`/`AsyncResult`.
 * @returns A mapper (data-last) or the chained `Result`/`AsyncResult` (data-first).
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
 * Maps the `ErrorResult` to a new value.
 * @param fn Mapper for the `ErrorResult`.
 * @returns A mapper (data-last) or the mapped `Result`/`AsyncResult` (data-first).
 */
export const mapError: {
	// data-last
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (e: ResolveErrorValue<R>) => any,
	>(
		fn: F,
	): (
		result: R,
	) => ResultFor<
		[R, ReturnType<F>],
		ResolveOkValue<R>,
		Awaited<ReturnType<F>>
	>;

	// data-first
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (e: ResolveErrorValue<R>) => any,
	>(
		result: R,
		fn: F,
	): ResultFor<[R, ReturnType<F>], ResolveOkValue<R>, Awaited<ReturnType<F>>>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (e: any) => any): any => {
	if (isPromiseLike(result)) return result.then(mapError(fn));
	if (result.ok) return ok(result.value);

	const out = fn(result.error);
	if (isPromiseLike(out)) return out.then(error);
	return error(out);
});

/**
 * Transforms the `ErrorResult` into another `Result`/`AsyncResult`.
 * @param fn Mapper from `ErrorResult` to `Result`/`AsyncResult`.
 * @returns A mapper (data-last) or the resulting `Result`/`AsyncResult` (data-first).
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
 * Converts an `ErrorResult` into an `OkResult`.
 * @param fn Mapper from `ErrorResult` to replacement `OkResult`.
 * @returns A mapper (data-last) or a `Result`/`AsyncResult` without `ErrorResult` (data-first).
 */
export const catchError: {
	// data-last
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (e: ResolveErrorValue<R>) => any,
	>(
		fn: F,
	): (
		result: R,
	) => ResultFor<
		[R, ReturnType<F>],
		ResolveOkValue<R> | Awaited<ReturnType<F>>,
		never
	>;

	// data-first
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (e: ResolveErrorValue<R>) => any,
	>(
		result: R,
		fn: F,
	): ResultFor<
		[R, ReturnType<F>],
		ResolveOkValue<R> | Awaited<ReturnType<F>>,
		never
	>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (e: any) => any): any => {
	if (isPromiseLike(result)) return result.then(catchError(fn));
	if (result.ok) return ok(result.value);

	const out = fn(result.error);
	if (isPromiseLike(out)) return out.then(ok);
	return ok(out);
});

export { catchError as catch };

/**
 * Runs a side effect on an `OkResult`.
 * @param onOk Handler to invoke with the `OkResult`.
 * @returns The original `Result`/`AsyncResult`.
 */
export const tap: {
	// data-last
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (v: ResolveOkValue<R>) => unknown | Promise<unknown>,
	>(
		onOk: F,
	): (
		result: R,
	) => R extends PromiseLike<any>
		? R
		: ReturnType<F> extends PromiseLike<any>
			? Promise<ResolveResult<R>>
			: ResolveResult<R>;

	// data-first
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (v: ResolveOkValue<R>) => unknown | Promise<unknown>,
	>(
		result: R,
		onOk: F,
	): R extends PromiseLike<any>
		? R
		: ReturnType<F> extends PromiseLike<any>
			? Promise<ResolveResult<R>>
			: ResolveResult<R>;
} = dual(
	2,
	(result: MaybeAsyncResult<any, any>, onOk: (v: any) => void): any => {
		if (isPromiseLike(result)) return result.then(tap(onOk));
		if (!result.ok) return result;

		const out = onOk(result.value);
		if (isPromiseLike(out)) return out.then(() => result);
		return result;
	},
);

/**
 * Runs a side effect on an `ErrorResult`.
 * @param onError Handler to invoke with the `ErrorResult`.
 * @returns The original `Result`/`AsyncResult`.
 */
export const tapError: {
	// data-last
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (e: ResolveErrorValue<R>) => unknown | Promise<unknown>,
	>(
		onError: F,
	): (
		result: R,
	) => R extends PromiseLike<any>
		? R
		: ReturnType<F> extends PromiseLike<any>
			? Promise<ResolveResult<R>>
			: ResolveResult<R>;

	// data-first
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (e: ResolveErrorValue<R>) => unknown | Promise<unknown>,
	>(
		result: R,
		onError: F,
	): R extends PromiseLike<any>
		? R
		: ReturnType<F> extends PromiseLike<any>
			? Promise<ResolveResult<R>>
			: ResolveResult<R>;
} = dual(
	2,
	(result: MaybeAsyncResult<any, any>, onError: (e: any) => void): any => {
		if (isPromiseLike(result)) return result.then(tapError(onError));
		if (result.ok) return result;

		const out = onError(result.error);
		if (isPromiseLike(out)) return out.then(() => result);
		return result;
	},
);

/**
 * Runs a side effect on either `OkResult` or `ErrorResult`.
 * @param onFinally Handler to invoke with the full `Result`.
 * @returns The original `Result`/`AsyncResult`.
 */
export const tapBoth: {
	// data-last
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (r: ResolveResult<R>) => unknown | Promise<unknown>,
	>(
		onFinally: F,
	): (
		result: R,
	) => R extends PromiseLike<any>
		? R
		: ReturnType<F> extends PromiseLike<any>
			? Promise<ResolveResult<R>>
			: ResolveResult<R>;

	// data-first
	<
		R extends MaybeAsyncResult<any, any>,
		F extends (r: ResolveResult<R>) => unknown | Promise<unknown>,
	>(
		result: R,
		onFinally: F,
	): R extends PromiseLike<any>
		? R
		: ReturnType<F> extends PromiseLike<any>
			? Promise<ResolveResult<R>>
			: ResolveResult<R>;
} = dual(
	2,
	(result: MaybeAsyncResult<any, any>, onFinally: (r: any) => void): any => {
		if (isPromiseLike(result)) return result.then(tapBoth(onFinally));

		const out = onFinally(result);
		if (isPromiseLike(out)) return out.then(() => result);
		return result;
	},
);

export { tapBoth as finally };

/**
 * Unwraps a `Result` by providing handlers for Ok and Error.
 * If the input is async, returns a PromiseLike of the union of handler outputs.
 */
type MatchReturn<R, V> = R extends PromiseLike<any> ? PromiseLike<V> : V;

/**
 * Applies the appropriate handler to an `OkResult` or `ErrorResult`
 * and returns whatever that handler returns.
 * @param onOk Handler called with the `OkResult` value.
 * @param onError Handler called with the `ErrorResult` value.
 * @returns The value returned by either `onOk` or `onError`.
 */
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
		if (isPromiseLike(result)) return result.then(match(onOk, onError));

		return result.ok ? onOk(result.value) : onError(result.error);
	},
);
