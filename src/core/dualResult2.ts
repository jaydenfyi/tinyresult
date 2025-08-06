import { dual } from "effect/Function";
import { pipe } from "effect";

export { pipe } from "effect";

export interface OkResult<T> {
    readonly ok: true;
    readonly value: T;
}

export interface ErrorResult<E> {
    readonly ok: false;
    readonly error: E;
}

export type Result<T, E> = OkResult<T> | ErrorResult<E>;
type AsyncResult<T, E> = PromiseLike<Result<T, E>>;
type MaybeAsyncResult<T, E> = Result<T, E> | AsyncResult<T, E>;

const isPromiseLike = (v: unknown): v is PromiseLike<unknown> =>
    !!v && typeof (v as any).then === "function";

type ResolveResult<R> =
    R extends PromiseLike<infer P> ? (P extends Result<any, any> ? P : never)
    : R extends Result<any, any> ? R
    : never;

export type ResolveOkValue<R> = ResolveResult<R> extends Result<infer T, any> ? T : never;
export type ResolveErrorValue<R> = ResolveResult<R> extends Result<any, infer E> ? E : never;

/**
 * Keeps your original helper: wraps based on the *input* R only.
 * Used by map/mapError/catchError where the mapper returns a plain value.
 */
type Rewrap<R, T, E> =
    R extends PromiseLike<any> ? AsyncResult<T, E> : Result<T, E>;

/**
 * New helper: wraps based on *either* the input (R) or the mapper result (RF).
 * If either is async, the overall is async. Used by flatMap/flatMapError.
 */
type Rewrap2<R, RF, T, E> =
    R extends PromiseLike<any> ? AsyncResult<T, E>
    : RF extends PromiseLike<any> ? AsyncResult<T, E>
    : Result<T, E>;

export type ExtractOkResultValues<R extends readonly MaybeAsyncResult<any, any>[]> = {
    -readonly [K in keyof R]: ResolveOkValue<R[K]>;
}

export type ExtractErrorResultValue<R extends readonly MaybeAsyncResult<any, any>[]> =
    ResolveErrorValue<R[number]>;

type ExtractOkValue<T extends MaybeAsyncResult<any, any>> =
    T extends Result<infer U, any> ? U
    : T extends AsyncResult<infer U, any> ? U
    : never;

type ExtractErrorValue<T extends MaybeAsyncResult<any, any>> =
    T extends Result<any, infer E> ? E
    : T extends AsyncResult<any, infer E> ? E
    : never;

export function ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

export function error<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

export function from<R extends AsyncResult<any, any>>(result: R): AsyncResult<ResolveOkValue<R>, ResolveErrorValue<R>>;
export function from<R extends Result<any, any>>(result: R): Result<ResolveOkValue<R>, ResolveErrorValue<R>>;
export function from(result: MaybeAsyncResult<any, any>): MaybeAsyncResult<any, any> {
    if (isPromiseLike(result)) {
        return (result as PromiseLike<Result<any, any>>).then(from);
    }
    return (result as Result<any, any>).ok
        ? ok((result as OkResult<any>).value)
        : error((result as ErrorResult<any>).error);
}

export function isResult(value: unknown): value is Result<unknown, unknown> {
    return !!value
        && typeof value === "object"
        && "ok" in (value as any)
        && (("value" in (value as any) && (value as any).ok === true)
            || ("error" in (value as any) && (value as any).ok === false));
}

export function tryCatch<T>(fn: () => PromiseLike<T>): PromiseLike<Result<T, unknown>>;
export function tryCatch<T>(fn: () => T): Result<T, unknown>;
export function tryCatch<T>(fn: () => T | PromiseLike<T>): Result<T, unknown> | PromiseLike<Result<T, unknown>> {
    try {
        const out = fn();
        if (isPromiseLike(out)) {
            return Promise.resolve(out as PromiseLike<T>)
                .then((v) => ok<T>(v), (e) => error<unknown>(e));
        }

        return ok<T>(out as T);
    } catch (e) {
        return error<unknown>(e);
    }
}

export { tryCatch as try }

/** ── all ───────────────────────────────────────────────────────────────────
 * If every input is sync, returns Result<…>; if *any* is async, returns AsyncResult<…>.
 */
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

    return Promise
        .all(results.map(r => isPromiseLike(r) ? r : Promise.resolve(r)))
        .then((resolved) => {
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
        fn: (v: ResolveOkValue<R>) => U
    ): (result: R) => Rewrap<R, U, ResolveErrorValue<R>>;

    // data-first
    <R extends MaybeAsyncResult<any, any>, U>(
        result: R,
        fn: (v: ResolveOkValue<R>) => U
    ): Rewrap<R, U, ResolveErrorValue<R>>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (v: any) => any): any => {
    if (isPromiseLike(result)) {
        return result.then((r) => map(r, fn));
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
    <R extends MaybeAsyncResult<any, any>, RF extends MaybeAsyncResult<any, any>>(
        fn: (v: ResolveOkValue<R>) => RF
    ): (result: R) => Rewrap2<R, RF, ResolveOkValue<RF>, ResolveErrorValue<R> | ResolveErrorValue<RF>>;

    // data-first
    <R extends MaybeAsyncResult<any, any>, RF extends MaybeAsyncResult<any, any>>(
        result: R,
        fn: (v: ResolveOkValue<R>) => RF
    ): Rewrap2<R, RF, ResolveOkValue<RF>, ResolveErrorValue<R> | ResolveErrorValue<RF>>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (v: any) => MaybeAsyncResult<any, any>): any => {
    if (isPromiseLike(result)) {
        return result.then((r) => flatMap(r, fn));
    }
    return result.ok ? fn(result.value) : error(result.error);
});

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
        fn: (e: ResolveErrorValue<R>) => F
    ): (result: R) => Rewrap<R, ResolveOkValue<R>, F>;

    // data-first
    <R extends MaybeAsyncResult<any, any>, F>(
        result: R,
        fn: (e: ResolveErrorValue<R>) => F
    ): Rewrap<R, ResolveOkValue<R>, F>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (e: any) => any): any => {
    if (isPromiseLike(result)) {
        return result.then((r) => mapError(r, fn));
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
    <R extends MaybeAsyncResult<any, any>, RF extends MaybeAsyncResult<any, any>>(
        fn: (e: ResolveErrorValue<R>) => RF
    ): (result: R) => Rewrap2<R, RF, ResolveOkValue<RF> | ResolveOkValue<R>, ResolveErrorValue<RF>>;

    // data-first
    <R extends MaybeAsyncResult<any, any>, RF extends MaybeAsyncResult<any, any>>(
        result: R,
        fn: (e: ResolveErrorValue<R>) => RF
    ): Rewrap2<R, RF, ResolveOkValue<RF> | ResolveOkValue<R>, ResolveErrorValue<RF>>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (e: any) => MaybeAsyncResult<any, any>): any => {
    if (isPromiseLike(result)) {
        return result.then((r) => flatMapError(r, fn));
    }
    return result.ok ? ok(result.value) : fn(result.error);
});

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
        fn: (e: ResolveErrorValue<R>) => U
    ): (result: R) => Rewrap<R, ResolveOkValue<R> | U, never>;

    // data-first
    <R extends MaybeAsyncResult<any, any>, U>(
        result: R,
        fn: (e: ResolveErrorValue<R>) => U
    ): Rewrap<R, ResolveOkValue<R> | U, never>;
} = dual(2, (result: MaybeAsyncResult<any, any>, fn: (e: any) => any): any => {
    if (isPromiseLike(result)) {
        return result.then((r) => catchError(r, fn));
    }
    return result.ok ? ok(result.value) : ok(fn(result.error));
});

/**
 * Performs a side-effect with the `Ok` value, returning the original `Result` unchanged.
 * Works for both sync and async transparently.
 */
export const tap: {
    <R extends MaybeAsyncResult<any, any>>(onOk: (v: ResolveOkValue<R>) => void): (result: R) => R;
    <R extends MaybeAsyncResult<any, any>>(result: R, onOk: (v: ResolveOkValue<R>) => void): R;
} = dual(2, (result: MaybeAsyncResult<any, any>, onOk: (v: any) => void): any => {
    if (isPromiseLike(result)) {
        return result.then((r) => tap(r, onOk));
    }
    if (result.ok) {
        onOk(result.value);
    }
    return result;
});

/**
 * Performs a side-effect with the `Error` value, returning the original `Result` unchanged.
 * Works for both sync and async transparently.
 */
export const tapError: {
    <R extends MaybeAsyncResult<any, any>>(onError: (e: ResolveErrorValue<R>) => void): (result: R) => R;
    <R extends MaybeAsyncResult<any, any>>(result: R, onError: (e: ResolveErrorValue<R>) => void): R;
} = dual(2, (result: MaybeAsyncResult<any, any>, onError: (e: any) => void): any => {
    if (isPromiseLike(result)) {
        return result.then((r) => tapError(r, onError));
    }
    if (!result.ok) {
        onError(result.error);
    }
    return result;
});

/**
 * Performs a side-effect on a `Result` (Ok or Error), returning the original `Result` unchanged.
 * Works for both sync and async transparently.
 */
export const tapBoth: {
    <R extends MaybeAsyncResult<any, any>>(onFinally: (r: ResolveResult<R>) => void): (result: R) => R;
    <R extends MaybeAsyncResult<any, any>>(result: R, onFinally: (r: ResolveResult<R>) => void): R;
} = dual(2, (result: MaybeAsyncResult<any, any>, onFinally: (r: any) => void): any => {
    if (isPromiseLike(result)) {
        return result.then((r) => tapBoth(r, onFinally));
    }
    onFinally(result);
    return result;
});

/**
 * Unwraps a `Result` by providing handlers for Ok and Error.
 * If the input is async, returns a PromiseLike of the union of handler outputs.
 */
type MatchReturn<R, V> = R extends PromiseLike<any> ? PromiseLike<V> : V;

export const match: {
    // data-last
    <R extends MaybeAsyncResult<any, any>, TValue, TError>(
        onOk: (v: ResolveOkValue<R>) => TValue,
        onError: (e: ResolveErrorValue<R>) => TError
    ): (result: R) => MatchReturn<R, TValue | TError>;

    // data-first
    <R extends MaybeAsyncResult<any, any>, TValue, TError>(
        result: R,
        onOk: (v: ResolveOkValue<R>) => TValue,
        onError: (e: ResolveErrorValue<R>) => TError
    ): MatchReturn<R, TValue | TError>;
} = dual(3, (result: MaybeAsyncResult<any, any>, onOk: (v: any) => any, onError: (e: any) => any): any => {
    if (isPromiseLike(result)) {
        return result.then((r) => match(r, onOk, onError));
    }
    return result.ok ? onOk(result.value) : onError(result.error);
});

/** ── example ─────────────────────────────────────────────────────────────── */

const validatedUsernameAsync = await all([tapBoth(mapError(
    map(
        flatMap(
            flatMap(ok("zuck" as const), async (username) => {
                if (username.length === 0) return error("EMPTY_USERNAME" as const);
                if (username.length < 2) return error("USERNAME_TOO_SHORT" as const);

                return ok(username);
            }),
            async (x) => {
                return ok(x.toUpperCase() as Uppercase<typeof x>);
            },
        ),
        (x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const,
    ),
    (error) => `Error is: ${error}` as const,
), (v) => {
    console.log(v);
})] as const);

const validatedUsernameSync = all([tapBoth(mapError(
    map(
        flatMap(
            flatMap(ok("zuck" as const), (username) => {
                if (username.length === 0) return error("EMPTY_USERNAME" as const);
                if (username.length < 2) return error("USERNAME_TOO_SHORT" as const);

                return ok(username);
            }),
            (x) => {
                return ok(x.toUpperCase() as Uppercase<typeof x>);
            },
        ),
        (x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const,
    ),
    (error) => `Error is: ${error}` as const,
), (v) => {
    console.log(v);
})] as const);



const validatedUsername2 = pipe(
    // this doesnt work unless I wrap ok in a promise
    ok("zuck" as const),
    flatMap(async (username) => {
        if (username.length === 0) return error("EMPTY_USERNAME" as const);
        if (username.length < 2) return error("USERNAME_TOO_SHORT" as const);

        return ok(username);
    }),
    flatMap((x) => ok(x.toUpperCase() as Uppercase<typeof x>)),
    map((x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const),
    mapError((error) => `Error is: ${error}` as const),
    tapBoth((v) => {
        console.log(v);
    }),
);

const validatedUsername3 = pipe(
    // this doesnt work unless I wrap ok in a promise
    ok("z" as const),
    flatMap((username) => {
        if (username.length === 0) return error("EMPTY_USERNAME" as const);
        if (username.length < 2) return error("USERNAME_TOO_SHORT" as const);

        return ok(username);
    }),
    flatMap((x) => ok(x.toUpperCase() as Uppercase<typeof x>)),
    map((x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const),
    mapError((error) => `Error is: ${error}` as const),
    tapBoth((v) => {
        console.log(v);
    }),
);

function validateUsername(username: string) {
    return pipe(
        ok(username),
        flatMap((username) => {
            if (username.length === 0) return error("EMPTY_USERNAME" as const);
            if (username.length < 2) return error("USERNAME_TOO_SHORT" as const);

            return ok(username);
        }),
        flatMap((x) => ok(x.toUpperCase() as Uppercase<typeof x>)),
        map((x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const),
        flatMapError(async (err) => error(`Error is: ${err}` as const)),
        tapBoth((v) => {
            console.log(v);
        }),
    );
}

function validateUsernameDataFirst(username: string) {
    return tapBoth(
        mapError(
            map(
                flatMap(
                    flatMap(ok(username), (username) => {
                        if (username.length === 0) return error("EMPTY_USERNAME" as const);
                        if (username.length < 2) return error("USERNAME_TOO_SHORT" as const);

                        return ok(username);
                    }),
                    (x) => ok(x.toUpperCase() as Uppercase<typeof x>),
                ),
                (x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const,
            ),
            (error) => `Error is: ${error}` as const,
        ),
        (v) => {
            console.log(v);
        },
    );
}

function validateUsernameImperative(username: string) {
    const result = ok(username);

    const flatMapped = flatMap(result, (username) => {
        if (username.length === 0) return error("EMPTY_USERNAME" as const);
        if (username.length < 2) return error("USERNAME_TOO_SHORT" as const);

        return ok(username);
    });

    if (!flatMapped.ok) {
        return flatMapped;
    }

    const uppercased = flatMap(flatMapped, (x) => ok(x.toUpperCase() as Uppercase<typeof x>));
    if (!uppercased.ok) {
        return uppercased;
    }

    const mapped = map(uppercased, (x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const);
    if (!mapped.ok) {
        return mapped;
    }

    return tapBoth(mapped, (v) => {
        console.log(v);
    });
}

function checkSomething() {
    if (validatedUsername3.ok) {
        console.log("Username is valid:", validatedUsername3.value);
        return;
    }

    console.log("Error:", validatedUsername3.error);
}

checkSomething();

pipe(validateUsername("batman"), map(x => x.toUpperCase()), tap(console.log));
pipe(validateUsername("b"), map(x => x.toUpperCase()), tap(console.log));

validateUsername("b").then((result) => {
    console.log("Async result:", result);
})