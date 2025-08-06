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

type Rewrap<R, T, E> =
    R extends PromiseLike<any> ? AsyncResult<T, E> : Result<T, E>;

export type ExtractOkResultValues<R extends readonly MaybeAsyncResult<any, any>[]> = {
    -readonly [K in keyof R]: ResolveOkValue<R[K]>
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
        && "ok" in value
        && (("value" in value && (value as any).ok === true)
            || ("error" in value && (value as any).ok === false));
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

export function all<R extends readonly AsyncResult<any, any>[]>(
    results: R,
): AsyncResult<ExtractOkResultValues<R>, ExtractErrorResultValue<R>>;
export function all<R extends readonly Result<any, any>[]>(
    results: R,
): Result<ExtractOkResultValues<R>, ExtractErrorResultValue<R>>;
export function all<R extends readonly MaybeAsyncResult<any, any>[]>(
    results: R,
): MaybeAsyncResult<ExtractOkResultValues<R>, ExtractErrorResultValue<R>> {
    const hasAsync = results.some(isPromiseLike);
    if (!hasAsync) {
        const values: any[] = [];
        for (const r of results as readonly Result<any, any>[]) {
            if (!r.ok) return error(r.error) as Result<ExtractOkResultValues<R>, ExtractErrorResultValue<R>>;
            values.push(r.value);
        }
        return ok(values) as Result<ExtractOkResultValues<R>, ExtractErrorResultValue<R>>;
    }

    return Promise.all(results as readonly PromiseLike<Result<any, any>>[])
        .then((resolved) => {
            const values: any[] = [];
            for (const r of resolved) {
                if (!r.ok) return error(r.error);
                values.push(r.value);
            }
            return ok(values);
        }) as AsyncResult<ExtractOkResultValues<R>, ExtractErrorResultValue<R>>;
}

export function map<R extends AsyncResult<any, any>, U>(
    result: R,
    fn: (v: ResolveOkValue<R>) => U,
): AsyncResult<U, ResolveErrorValue<R>>;
export function map<R extends Result<any, any>, U>(
    result: R,
    fn: (v: ResolveOkValue<R>) => U,
): Result<U, ResolveErrorValue<R>>;
export function map<R extends MaybeAsyncResult<any, any>, U>(
    result: R,
    fn: (v: ResolveOkValue<R>) => U,
): Rewrap<R, U, ResolveErrorValue<R>> {
    if (isPromiseLike(result)) {
        return (result as PromiseLike<Result<any, any>>)
            .then((r) => (r.ok ? ok(fn(r.value)) : error(r.error))) as Rewrap<R, U, ResolveErrorValue<R>>;
    }

    return (result.ok ? ok(fn(result.value)) : error(result.error)) as Rewrap<R, U, ResolveErrorValue<R>>;
}

export function flatMap<
    R extends AsyncResult<any, any>,
    RF extends MaybeAsyncResult<any, any>
>(
    result: R,
    fn: (v: ResolveOkValue<R>) => RF,
): AsyncResult<ResolveOkValue<RF>, ResolveErrorValue<R> | ResolveErrorValue<RF>>;
export function flatMap<
    R extends Result<any, any>,
    RF extends AsyncResult<any, any>
>(
    result: R,
    fn: (v: ResolveOkValue<R>) => RF,
): AsyncResult<ResolveOkValue<RF>, ResolveErrorValue<R> | ResolveErrorValue<RF>>;
export function flatMap<
    R extends Result<any, any>,
    RF extends Result<any, any>
>(
    result: R,
    fn: (v: ResolveOkValue<R>) => RF,
): Result<ResolveOkValue<RF>, ResolveErrorValue<R> | ResolveErrorValue<RF>>;
export function flatMap<
    R extends MaybeAsyncResult<any, any>,
    RF extends MaybeAsyncResult<any, any>
>(
    result: R,
    fn: (v: ResolveOkValue<R>) => RF,
): MaybeAsyncResult<ResolveOkValue<RF>, ResolveErrorValue<R> | ResolveErrorValue<RF>> {
    const toErrorOfRF = <E>(e: E) => error<E>(e);

    if (isPromiseLike(result)) {
        return (result as PromiseLike<Result<any, any>>).then((r) => {
            if (!r.ok) return toErrorOfRF(r.error);
            const out = fn(r.value);
            return isPromiseLike(out) ? out : from(out);
        }) as MaybeAsyncResult<ResolveOkValue<RF>, ResolveErrorValue<RF>>;
    }

    const r = result as Result<any, any>;
    if (!r.ok) return toErrorOfRF(r.error) as MaybeAsyncResult<ResolveOkValue<RF>, ResolveErrorValue<RF>>;

    const out = fn(r.value);
    return (isPromiseLike(out) ? out : from(out)) as MaybeAsyncResult<ResolveOkValue<RF>, ResolveErrorValue<RF>>;
}

export function mapError<R extends AsyncResult<any, any>, F>(
    result: R,
    fn: (e: ResolveErrorValue<R>) => F,
): AsyncResult<ResolveOkValue<R>, F>;
export function mapError<R extends Result<any, any>, F>(
    result: R,
    fn: (e: ResolveErrorValue<R>) => F,
): Result<ResolveOkValue<R>, F>;
export function mapError<R extends MaybeAsyncResult<any, any>, F>(
    result: R,
    fn: (e: ResolveErrorValue<R>) => F,
): Rewrap<R, ResolveOkValue<R>, F> {
    if (isPromiseLike(result)) {
        return (result as PromiseLike<Result<any, any>>)
            .then((r) => (r.ok ? ok(r.value) : error(fn(r.error)))) as Rewrap<R, ResolveOkValue<R>, F>;
    }
    const r = result as Result<any, any>;
    return (r.ok ? ok(r.value) : error(fn(r.error))) as Rewrap<R, ResolveOkValue<R>, F>;
}

export function flatMapError<
    R extends AsyncResult<any, any>,
    RF extends MaybeAsyncResult<any, any>
>(
    result: R,
    fn: (e: ResolveErrorValue<R>) => RF,
): AsyncResult<ResolveOkValue<R> | ResolveOkValue<RF>, ResolveErrorValue<RF>>;
export function flatMapError<
    R extends Result<any, any>,
    RF extends AsyncResult<any, any>
>(
    result: R,
    fn: (e: ResolveErrorValue<R>) => RF,
): AsyncResult<ResolveOkValue<R> | ResolveOkValue<RF>, ResolveErrorValue<RF>>;
export function flatMapError<
    R extends Result<any, any>,
    RF extends Result<any, any>
>(
    result: R,
    fn: (e: ResolveErrorValue<R>) => RF,
): Result<ResolveOkValue<R> | ResolveOkValue<RF>, ResolveErrorValue<RF>>;
export function flatMapError<
    R extends MaybeAsyncResult<any, any>,
    RF extends MaybeAsyncResult<any, any>
>(
    result: R,
    fn: (e: ResolveErrorValue<R>) => RF,
): MaybeAsyncResult<ResolveOkValue<R> | ResolveOkValue<RF>, ResolveErrorValue<RF>> {
    if (isPromiseLike(result)) {
        return (result as PromiseLike<Result<any, any>>).then((r) => {
            if (r.ok) return ok(r.value);
            const out = fn(r.error);
            return isPromiseLike(out) ? out : from(out);
        }) as MaybeAsyncResult<ResolveOkValue<R> | ResolveOkValue<RF>, ResolveErrorValue<RF>>;
    }

    const r = result as Result<any, any>;
    if (r.ok) return ok(r.value) as MaybeAsyncResult<ResolveOkValue<R> | ResolveOkValue<RF>, ResolveErrorValue<RF>>;

    const out = fn(r.error);
    return (isPromiseLike(out) ? out : from(out)) as MaybeAsyncResult<ResolveOkValue<R> | ResolveOkValue<RF>, ResolveErrorValue<RF>>;
}

export function catchError<R extends AsyncResult<any, any>, U>(
    result: R,
    fn: (e: ResolveErrorValue<R>) => U,
): AsyncResult<ResolveOkValue<R> | U, never>;
export function catchError<R extends Result<any, any>, U>(
    result: R,
    fn: (e: ResolveErrorValue<R>) => U,
): Result<ResolveOkValue<R> | U, never>;
export function catchError<R extends MaybeAsyncResult<any, any>, U>(
    result: R,
    fn: (e: ResolveErrorValue<R>) => U,
): Rewrap<R, ResolveOkValue<R> | U, never> {
    if (isPromiseLike(result)) {
        return (result as PromiseLike<Result<any, any>>)
            .then((r) => (r.ok ? ok(r.value) : ok(fn(r.error)))) as Rewrap<R, ResolveOkValue<R> | U, never>;
    }
    const r = result as Result<any, any>;
    return (r.ok ? ok(r.value) : ok(fn(r.error))) as Rewrap<R, ResolveOkValue<R> | U, never>;
}

export function tap<R extends AsyncResult<any, any>>(
    result: R,
    onOk: (v: ResolveOkValue<R>) => void,
): R;
export function tap<R extends Result<any, any>>(
    result: R,
    onOk: (v: ResolveOkValue<R>) => void,
): R;
export function tap<R extends MaybeAsyncResult<any, any>>(
    result: R,
    onOk: (v: ResolveOkValue<R>) => void,
): R {
    if (isPromiseLike(result)) {
        return (result as PromiseLike<Result<any, any>>)
            .then((r) => {
                if (r.ok) onOk(r.value);
                return r;
            }) as R;
    }
    const r = result as Result<any, any>;
    if (r.ok) onOk(r.value);
    return result;
}

export function tapError<R extends AsyncResult<any, any>>(
    result: R,
    onError: (e: ResolveErrorValue<R>) => void,
): R;
export function tapError<R extends Result<any, any>>(
    result: R,
    onError: (e: ResolveErrorValue<R>) => void,
): R;
export function tapError<R extends MaybeAsyncResult<any, any>>(
    result: R,
    onError: (e: ResolveErrorValue<R>) => void,
): R {
    if (isPromiseLike(result)) {
        return (result as PromiseLike<Result<any, any>>)
            .then((r) => {
                if (!r.ok) onError(r.error);
                return r;
            }) as R;
    }
    const r = result as Result<any, any>;
    if (!r.ok) onError(r.error);
    return result;
}

export function tapBoth<R extends AsyncResult<any, any>>(
    result: R,
    onFinally: (r: ResolveResult<R>) => void,
): R;
export function tapBoth<R extends Result<any, any>>(
    result: R,
    onFinally: (r: ResolveResult<R>) => void,
): R;
export function tapBoth<R extends MaybeAsyncResult<any, any>>(
    result: R,
    onFinally: (r: ResolveResult<R>) => void,
): R {
    if (isPromiseLike(result)) {
        return (result as PromiseLike<Result<any, any>>)
            .then((r) => {
                onFinally(r as ResolveResult<R>);
                return r;
            }) as R;
    }
    const r = result as Result<any, any>;
    onFinally(r as ResolveResult<R>);
    return result;
}

export function match<R extends AsyncResult<any, any>, TValue, TError>(
    result: R,
    onOk: (v: ResolveOkValue<R>) => TValue,
    onError: (e: ResolveErrorValue<R>) => TError,
): PromiseLike<TValue | TError>;
export function match<R extends Result<any, any>, TValue, TError>(
    result: R,
    onOk: (v: ResolveOkValue<R>) => TValue,
    onError: (e: ResolveErrorValue<R>) => TError,
): TValue | TError;
export function match<R extends MaybeAsyncResult<any, any>, TValue, TError>(
    result: R,
    onOk: (v: ResolveOkValue<R>) => TValue,
    onError: (e: ResolveErrorValue<R>) => TError,
): TValue | TError | PromiseLike<TValue | TError> {
    if (isPromiseLike(result)) {
        return (result as PromiseLike<Result<any, any>>)
            .then((r) => r.ok ? onOk(r.value) : onError(r.error));
    }
    const r = result as Result<any, any>;
    return r.ok ? onOk(r.value) : onError(r.error);
}

/** ── example ─────────────────────────────────────────────────────────────── */

const validatedUsername = await all([tapBoth(mapError(
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