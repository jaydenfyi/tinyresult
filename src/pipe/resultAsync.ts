// src/pipe/resultAsync.ts
// Curried, pipe‑friendly helpers with overloads that keep chains sync
// until an async callback or async upstream appears. Each outer overload
// returns a function with TWO call signatures (sync Result | PromiseLike<Result>).
// Implementations are lax and delegate to ../core/resultAsync.js.

import {
    map as mapFn,
    flatMap as flatMapFn,
    mapError as mapErrorFn,
    flatMapError as flatMapErrorFn,
    catchError as catchErrorFn,
    tap as tapFn,
    tapError as tapErrorFn,
    tapBoth as finallyFn,
    match as matchFn,
    type Result as CoreResult,
} from "../core/resultAsync.js";

export type Result<T, E = unknown> = CoreResult<T, E>;
export { ok, error, from, isResult, tryCatch, all } from "../core/resultAsync.js";

/* =======================================
 * map
 * =======================================
 */

// sync callback → returned function supports both sync and async inputs
export function map<T, E, U>(
    fn: (value: T) => U,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<U, E>>;
    (result: CoreResult<T, E>): CoreResult<U, E>;
};
// async callback → returned function supports both inputs, always async result
export function map<T, E, U>(
    fn: (value: T) => PromiseLike<U>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<U, E>>;
    (result: CoreResult<T, E>): PromiseLike<CoreResult<U, E>>;
};
export function map(fn: (value: unknown) => unknown): any {
    return (result: unknown) => (mapFn as any)(result, fn);
}

/* =======================================
 * flatMap
 * =======================================
 */

export function flatMap<T, E, U, F = E>(
    fn: (value: T) => CoreResult<U, F>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<U, F>>;
    (result: CoreResult<T, E>): CoreResult<U, F>;
};
export function flatMap<T, E, U, F = E>(
    fn: (value: T) => PromiseLike<CoreResult<U, F>>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<U, F>>;
    (result: CoreResult<T, E>): PromiseLike<CoreResult<U, F>>;
};
export function flatMap(fn: (value: unknown) => unknown): any {
    return (result: unknown) => (flatMapFn as any)(result, fn);
}

/* =======================================
 * mapError
 * =======================================
 */

export function mapError<T, E, F>(
    fn: (error: E) => F,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T, F>>;
    (result: CoreResult<T, E>): CoreResult<T, F>;
};
export function mapError<T, E, F>(
    fn: (error: E) => PromiseLike<F>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T, F>>;
    (result: CoreResult<T, E>): PromiseLike<CoreResult<T, F>>;
};
export function mapError(fn: (error: unknown) => unknown): any {
    return (result: unknown) => (mapErrorFn as any)(result, fn);
}

/* =======================================
 * flatMapError
 * =======================================
 */

export function flatMapError<T, E, U, F = E>(
    fn: (error: E) => CoreResult<U, F>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T | U, F>>;
    (result: CoreResult<T, E>): CoreResult<T | U, F>;
};
export function flatMapError<T, E, U, F = E>(
    fn: (error: E) => PromiseLike<CoreResult<U, F>>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T | U, F>>;
    (result: CoreResult<T, E>): PromiseLike<CoreResult<T | U, F>>;
};
export function flatMapError(fn: (error: unknown) => unknown): any {
    return (result: unknown) => (flatMapErrorFn as any)(result, fn);
}

/* =======================================
 * catchError
 * =======================================
 */

export function catchError<T, E, U>(
    fn: (error: E) => U,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T | U, never>>;
    (result: CoreResult<T, E>): CoreResult<T | U, never>;
};
export function catchError<T, E, U>(
    fn: (error: E) => PromiseLike<U>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T | U, never>>;
    (result: CoreResult<T, E>): PromiseLike<CoreResult<T | U, never>>;
};
export function catchError(fn: (error: unknown) => unknown): any {
    return (result: unknown) => (catchErrorFn as any)(result, fn);
}

/* =======================================
 * tap
 * =======================================
 */

export function tap<T, E>(
    onOk: (value: T) => void,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T, E>>;
    (result: CoreResult<T, E>): CoreResult<T, E>;
};
export function tap<T, E>(
    onOk: (value: T) => PromiseLike<void>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T, E>>;
    (result: CoreResult<T, E>): PromiseLike<CoreResult<T, E>>;
};
export function tap(onOk: (value: unknown) => unknown): any {
    return (result: unknown) => (tapFn as any)(result, onOk);
}

/* =======================================
 * tapError
 * =======================================
 */

export function tapError<T, E>(
    onError: (error: E) => void,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T, E>>;
    (result: CoreResult<T, E>): CoreResult<T, E>;
};
export function tapError<T, E>(
    onError: (error: E) => PromiseLike<void>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T, E>>;
    (result: CoreResult<T, E>): PromiseLike<CoreResult<T, E>>;
};
export function tapError(onError: (error: unknown) => unknown): any {
    return (result: unknown) => (tapErrorFn as any)(result, onError);
}

/* =======================================
 * tapBoth
 * =======================================
 */

export function tapBoth<T, E>(
    callbackFn: () => void,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T, E>>;
    (result: CoreResult<T, E>): CoreResult<T, E>;
};
export function tapBoth<T, E>(
    callbackFn: () => PromiseLike<void>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<CoreResult<T, E>>;
    (result: CoreResult<T, E>): PromiseLike<CoreResult<T, E>>;
};
export function tapBoth(callbackFn: () => unknown): any {
    return (result: unknown) => (finallyFn as any)(result, callbackFn as any);
}

/* =======================================
 * match
 * =======================================
 */

// sync handlers → returned function has two call signatures
export function match<T, E, TValue, TError>(
    onOk: (value: T) => TValue,
    onError: (error: E) => TError,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<TValue | TError>;
    (result: CoreResult<T, E>): TValue | TError;
};
// async handlers (either is async) → both inputs return PromiseLike
export function match<T, E, TValue, TError>(
    onOk: (value: T) => PromiseLike<TValue>,
    onError: (error: E) => TError | PromiseLike<TError>,
): {
    (result: PromiseLike<CoreResult<T, E>>): PromiseLike<TValue | TError>;
    (result: CoreResult<T, E>): PromiseLike<TValue | TError>;
};
export function match(
    onOk: (value: unknown) => unknown,
    onError: (error: unknown) => unknown,
): any {
    return (result: unknown) => (matchFn as any)(result, onOk, onError);
}
