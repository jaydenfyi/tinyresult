export interface OkResult<T> {
  readonly ok: true;
  readonly value: T;
}
export interface ErrorResult<E = unknown> {
  readonly ok: false;
  readonly error: E;
}

export type ResultLike<T, E = unknown> = OkResult<T> | ErrorResult<E>;

type ResultLikeInternal<T, E = unknown> = {
  ok: boolean;
  value?: T;
  error?: E;
};

// ───────────────────────────────────────────────────────────
// 1) Synchronous Result
// ───────────────────────────────────────────────────────────

export interface ResultPrototype<T, E> {
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

export type Result<T, E = unknown> = (OkResult<T> | ErrorResult<E>) &
  ResultPrototype<T, E>;

export interface ResultConstructor {
  // new <T, E = unknown>(
  //   executor: (
  //     ok: (v: T) => Result<T, never>,
  //     error: (e: E) => Result<never, E>,
  //   ) => Result<T, E>,
  // ): Result<T, E>;
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

export interface AsyncResultPrototype<T, E> {
  map<U>(callbackFn: (value: T) => U | PromiseLike<U>): AsyncResult<U, E>;
  flatMap<U, F = E>(
    callbackFn: (value: T) => AsyncResult<U, F>,
  ): AsyncResult<U, F>;

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

export interface AsyncResult<T, E = unknown>
  extends PromiseLike<Result<T, E>>,
    AsyncResultPrototype<T, E> {}

export interface AsyncResultConstructor {
  new <T, E = unknown>(
    executor: (ok: (value: T) => void, err: (error: E) => void) => void,
  ): AsyncResult<T, E>;

  ok<T>(value: T): AsyncResult<T, never>;
  error<E>(error: E): AsyncResult<never, E>;
  try<T, E = unknown>(callbackFn: () => T | Promise<T>): AsyncResult<T, E>;
  all<T, E = unknown>(
    iterable: Iterable<T | AsyncResult<T, E>>,
  ): AsyncResult<T[], E>;
  from<T, E = unknown>(
    result: ResultLike<T, E> | Promise<ResultLike<T, E>>,
  ): AsyncResult<T, E>;
  fromPromise<T, E = unknown>(
    promise: Promise<T>,
    mapErrorFn?: (reason: unknown) => E,
  ): AsyncResult<T, E>;
  isAsyncResult(
    asyncResult: unknown,
  ): asyncResult is AsyncResult<unknown, unknown>;

  // —— Species for correct subclassing via `then()`
  readonly [Symbol.species]: AsyncResultConstructor;

  readonly prototype: AsyncResult<unknown, unknown>;
}

function isThenable<T = unknown>(value: unknown): value is PromiseLike<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as any).then === "function"
  );
}

export class ResultImplementation<T, E = unknown>
  implements ResultLikeInternal<T, E>, ResultPrototype<T, E>
{
  readonly ok: boolean;
  readonly value?: T;
  readonly error?: E;

  private constructor(rawResult: ResultLike<T, E>) {
    this.ok = rawResult.ok;

    if (!rawResult.ok) {
      this.error = rawResult.error;
      return;
    }

    this.value = rawResult.value;
  }

  // Static methods
  static ok<T>(value: T): Result<T, never> {
    return new ResultImplementation({ ok: true, value }) as Result<T, never>;
  }

  static error<E>(error: E): Result<never, E> {
    return new ResultImplementation({ ok: false, error }) as Result<never, E>;
  }

  static try<T, E = unknown>(callbackFn: () => T): Result<T, E> {
    try {
      return ResultImplementation.ok(callbackFn());
    } catch (e) {
      return ResultImplementation.error(e as E);
    }
  }

  static all<T, E>(iterable: Iterable<Result<T, E>>): Result<T[], E> {
    const values: T[] = [];
    for (const result of iterable) {
      if (!result.ok) {
        return result as Result<never, E>;
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

  // This is required to make the Newable signature work
  static get [Symbol.species]() {
    return ResultImplementation;
  }

  // Instance methods (implementing ResultPrototype)
  map<U>(callbackFn: (value: T) => PromiseLike<U>): AsyncResult<U, E>;
  map<U>(callbackFn: (value: T) => U): Result<U, E>;
  map<U>(
    callbackFn: (value: T) => U | PromiseLike<U>,
  ): Result<U, E> | AsyncResult<U, E> {
    if (!this.ok) {
      return this as unknown as Result<U, E>;
    }

    const mappedValue = callbackFn(this.value!);
    if (isThenable(mappedValue)) {
      return new AsyncResultImplementation<U, E>((okCallback, errCallback) => {
        Promise.resolve(mappedValue)
          .then(okCallback)
          .catch((reason) => errCallback(reason as E));
      });
    }

    return ResultImplementation.ok(mappedValue);
  }

  flatMap<U, F = E>(
    callbackFn: (value: T) => PromiseLike<Result<U, F>>,
  ): AsyncResult<U, F>;
  flatMap<U, F = E>(callbackFn: (value: T) => Result<U, F>): Result<U, F>;
  flatMap<U, F = E>(
    callbackFn: (value: T) => Result<U, F> | PromiseLike<Result<U, F>>,
  ): Result<U, F> | AsyncResult<U, F> {
    if (!this.ok) {
      return this as unknown as Result<U, F>;
    }

    const flatMappedResult = callbackFn(this.value!);
    if (isThenable(flatMappedResult)) {
      return new AsyncResultImplementation<U, F>((okCallback, errCallback) => {
        Promise.resolve(flatMappedResult)
          .then((result) => {
            if (!result.ok) {
              return errCallback(result.error);
            }

            okCallback(result.value);
          })
          .catch((reason) => errCallback(reason as F));
      });
    }

    return flatMappedResult;
  }

  mapError<F>(callbackFn: (error: E) => PromiseLike<F>): AsyncResult<T, F>;
  mapError<F>(callbackFn: (error: E) => F): Result<T, F>;
  mapError<F>(
    callbackFn: (error: E) => F | PromiseLike<F>,
  ): Result<T, F> | AsyncResult<T, F> {
    if (this.ok) {
      return this as unknown as Result<T, F>;
    }

    const mappedError = callbackFn(this.error!);
    if (isThenable(mappedError)) {
      return new AsyncResultImplementation<T, F>((okCallback, errCallback) => {
        Promise.resolve(mappedError)
          .then((newError) => errCallback(newError))
          .catch((reason) => errCallback(reason as F));
      });
    }

    return ResultImplementation.error(mappedError);
  }

  flatMapError<U, F = E>(
    callbackFn: (error: E) => PromiseLike<Result<U, F>>,
  ): AsyncResult<U, F>;
  flatMapError<U, F = E>(callbackFn: (error: E) => Result<U, F>): Result<U, F>;
  flatMapError<U, F = E>(
    callbackFn: (error: E) => Result<U, F> | PromiseLike<Result<U, F>>,
  ): Result<U, F> | AsyncResult<U, F> {
    if (this.ok) {
      return this as unknown as Result<U, F>;
    }

    const flatMappedErrorResult = callbackFn(this.error!);
    if (isThenable(flatMappedErrorResult)) {
      return new AsyncResultImplementation<U, F>((okCallback, errCallback) => {
        Promise.resolve(flatMappedErrorResult)
          .then((result) => {
            if (!result.ok) {
              return errCallback(result.error);
            }

            okCallback(result.value);
          })
          .catch((reason) => errCallback(reason as F));
      });
    }

    return flatMappedErrorResult;
  }

  catch<U>(callbackFn: (error: E) => PromiseLike<U>): AsyncResult<T | U, never>;
  catch<U>(callbackFn: (error: E) => U): Result<T | U, never>;
  catch<U>(
    callbackFn: (error: E) => U | PromiseLike<U>,
  ): Result<T | U, never> | AsyncResult<T | U, never> {
    if (this.ok) {
      return this as unknown as Result<T | U, never>;
    }

    const caughtValue = callbackFn(this.error!);
    if (isThenable(caughtValue)) {
      return new AsyncResultImplementation<T | U, never>((okCallback) => {
        Promise.resolve(caughtValue).then(okCallback);
      });
    }

    return ResultImplementation.ok(caughtValue);
  }

  tap(onOk: (value: T) => PromiseLike<void>): AsyncResult<T, E>;
  tap(onOk: (value: T) => void): Result<T, E>;
  tap(
    onOk: (value: T) => void | PromiseLike<void>,
  ): Result<T, E> | AsyncResult<T, E> {
    if (!this.ok) {
      return this as Result<T, E>;
    }

    const tapResult = onOk(this.value!);
    if (isThenable(tapResult)) {
      return new AsyncResultImplementation<T, E>((okCallback, errCallback) => {
        Promise.resolve(tapResult)
          .then(() => okCallback(this.value!))
          .catch((reason) => errCallback(reason as E));
      });
    }

    return this as Result<T, E>;
  }

  tapError(onError: (error: E) => PromiseLike<void>): AsyncResult<T, E>;
  tapError(onError: (error: E) => void): Result<T, E>;
  tapError(
    onError: (error: E) => void | PromiseLike<void>,
  ): Result<T, E> | AsyncResult<T, E> {
    if (this.ok) {
      return this as Result<T, E>;
    }

    const tapErrorResult = onError(this.error!);
    if (isThenable(tapErrorResult)) {
      return new AsyncResultImplementation<T, E>((okCallback, errCallback) => {
        Promise.resolve(tapErrorResult)
          .then(() => errCallback(this.error!)) // Still propagate original error if tapError succeeds
          .catch((reason) => okCallback(reason as T)); // If tapError promise rejects, it becomes an Ok value
      });
    }

    return this as Result<T, E>;
  }

  finally(onFinally: () => PromiseLike<void>): AsyncResult<T, E>;
  finally(onFinally: () => void): Result<T, E>;
  finally(
    onFinally: () => void | PromiseLike<void>,
  ): Result<T, E> | AsyncResult<T, E> {
    const onFinallyResult = onFinally();
    if (isThenable(onFinallyResult)) {
      return new AsyncResultImplementation<T, E>((okCallback, errCallback) => {
        Promise.resolve(onFinallyResult).then(() => {
          if (!this.ok) {
            return errCallback(this.error!);
          }

          okCallback(this.value!);
        });
      });
    }

    return this as Result<T, E>;
  }

  match<TValue, TError>(
    onOk: (value: T) => TValue,
    onError: (error: E) => TError,
  ): TValue | TError {
    return this.ok ? onOk(this.value!) : onError(this.error!);
  }

  get [Symbol.toStringTag](): "Result" {
    return "Result";
  }
}

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

  // Static methods
  static ok<T>(value: T): AsyncResult<T, never> {
    return new AsyncResultImplementation<T, never>((ok) => ok(value));
  }

  static error<E>(error: E): AsyncResult<never, E> {
    return new AsyncResultImplementation<never, E>((_, err) => err(error));
  }

  static try<T, E = unknown>(
    callbackFn: () => T | Promise<T>,
  ): AsyncResult<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      Promise.resolve().then(async () => {
        try {
          const result = callbackFn();
          const value = result instanceof Promise ? await result : result;
          ok(value);
        } catch (e) {
          err(e as E);
        }
      });
    });
  }

  static all<T, E = unknown>(
    iterable: Iterable<T | AsyncResult<T, E>>,
  ): AsyncResult<T[], E> {
    const promises = Array.from(iterable).map((item) => {
      if (AsyncResultImplementation.isAsyncResult(item)) {
        return item.then((result) => result);
      }

      return Promise.resolve(ResultImplementation.ok(item as T));
    });

    return new AsyncResultImplementation<T[], E>((ok, err) => {
      Promise.all(promises)
        .then((results) => {
          const allResults = ResultImplementation.all(results);

          if (!allResults.ok) {
            return err(allResults.error);
          }

          ok(allResults.value);
        })
        .catch((e) => err(e as E));
    });
  }

  static from<T, E = unknown>(
    result: ResultLike<T, E> | Promise<ResultLike<T, E>>,
  ): AsyncResult<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      Promise.resolve(result).then((r) => {
        if (!r.ok) {
          return err(r.error);
        }

        ok(r.value);
      });
    });
  }

  static fromPromise<T, E = unknown>(
    promise: Promise<T>,
    mapErrorFn?: (reason: unknown) => E,
  ): AsyncResult<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      promise.then(
        (value) => ok(value),
        (reason) => err(mapErrorFn ? mapErrorFn(reason) : (reason as E)),
      );
    });
  }

  static isAsyncResult(
    asyncResult: unknown,
  ): asyncResult is AsyncResult<unknown, unknown> {
    return asyncResult instanceof AsyncResultImplementation;
  }

  // This is required to make the Newable signature work
  static get [Symbol.species]() {
    return AsyncResultImplementation;
  }

  // Instance methods
  then<TResult1 = Result<T, E>, TResult2 = never>(
    onfulfilled?:
      | ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected);
  }

  map<U>(callbackFn: (value: T) => U | PromiseLike<U>): AsyncResult<U, E> {
    return new AsyncResultImplementation<U, E>((ok, err) => {
      this._promise.then((result) => {
        if (!result.ok) {
          return err(result.error);
        }

        Promise.resolve(callbackFn(result.value))
          .then(ok)
          .catch((reason) => err(reason as E));
      });
    });
  }

  flatMap<U, F = E>(
    callbackFn: (value: T) => AsyncResult<U, F>,
  ): AsyncResult<U, F> {
    return new AsyncResultImplementation<U, F>((ok, err) => {
      this._promise.then((result) => {
        if (!result.ok) {
          return err(result.error as unknown as F);
        }

        callbackFn(result.value).then((innerResult) => {
          if (!innerResult.ok) {
            return err(innerResult.error);
          }

          ok(innerResult.value);
        });
      });
    });
  }

  mapError<F>(callbackFn: (error: E) => F | PromiseLike<F>): AsyncResult<T, F> {
    return new AsyncResultImplementation<T, F>((ok, err) => {
      this._promise.then((result) => {
        if (result.ok) {
          return ok(result.value);
        }

        Promise.resolve(callbackFn(result.error))
          .then(err)
          .catch((reason) => ok(reason as T));
      });
    });
  }

  flatMapError<U, F = E>(
    callbackFn: (error: E) => AsyncResult<U, F>,
  ): AsyncResult<U, F> {
    return new AsyncResultImplementation<U, F>((ok, err) => {
      this._promise.then((result) => {
        if (result.ok) {
          return ok(result.value as unknown as U);
        }

        callbackFn(result.error).then((innerResult) => {
          if (!innerResult.ok) {
            return err(innerResult.error);
          }

          ok(innerResult.value);
        });
      });
    });
  }

  catch<U>(
    callbackFn: (error: E) => U | PromiseLike<U>,
  ): AsyncResult<U, never> {
    return new AsyncResultImplementation<U, never>((ok, err) => {
      this._promise.then((result) => {
        if (result.ok) {
          return ok(result.value as unknown as U);
        }

        Promise.resolve(callbackFn(result.error))
          .then(ok)
          .catch((reason) => {
            throw reason;
          });
      });
    });
  }

  tap(onOk: (value: T) => void | PromiseLike<void>): AsyncResult<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      this._promise.then((result) => {
        if (!result.ok) {
          return err(result.error);
        }

        Promise.resolve(onOk(result.value))
          .then(() => ok(result.value))
          .catch((reason) => err(reason as E));
      });
    });
  }

  tapError(onError: (error: E) => void | PromiseLike<void>): AsyncResult<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      this._promise.then((result) => {
        if (result.ok) {
          return ok(result.value);
        }

        Promise.resolve(onError(result.error))
          .then(() => err(result.error))
          .catch((reason) => ok(reason as T));
      });
    });
  }

  finally(onFinally: () => void | PromiseLike<void>): AsyncResult<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      this._promise.then((result) => {
        Promise.resolve(onFinally())
          .then(() => {
            if (!result.ok) {
              return err(result.error);
            }

            ok(result.value);
          })
          .catch((reason) => err(reason as E));
      });
    });
  }

  match<TValue, TError>(
    onOk: (value: T) => TValue | PromiseLike<TValue>,
    onError: (error: E) => TError | PromiseLike<TError>,
  ): Promise<TValue | TError> {
    // Use a simpler approach that directly returns a Promise
    return this._promise.then(async (result): Promise<TValue | TError> => {
      if (!result.ok) {
        return await Promise.resolve(onError(result.error));
      }

      return await Promise.resolve(onOk(result.value));
    });
  }

  get [Symbol.toStringTag](): "AsyncResult" {
    return "AsyncResult";
  }
}

export const Result: ResultConstructor =
  ResultImplementation as unknown as ResultConstructor;
export const AsyncResult: AsyncResultConstructor = AsyncResultImplementation;
