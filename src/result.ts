// src/index.ts
// Runtime implementation for Result and AsyncResult types

import type {
  AsyncResult as AsyncResultType,
  AsyncResultConstructor,
  ErrorResult,
  OkResult,
  Result as ResultType,
  ResultConstructor,
  ResultLike,
} from "./types.js";

export type { ResultType, AsyncResultType, ResultLike, OkResult, ErrorResult };

class ResultImplementation<T, E = unknown> {
  readonly ok: boolean;
  readonly value?: T;
  readonly error?: E;

  private constructor(rawResult: OkResult<T> | ErrorResult<E>) {
    this.ok = rawResult.ok;
    if (rawResult.ok) {
      this.value = rawResult.value;
    } else {
      this.error = rawResult.error;
    }
  }

  // Static methods
  static ok<T>(value: T): ResultType<T, never> {
    return new ResultImplementation({ ok: true, value }) as ResultType<
      T,
      never
    >;
  }

  static error<E>(error: E): ResultType<never, E> {
    return new ResultImplementation({ ok: false, error }) as ResultType<
      never,
      E
    >;
  }

  static try<T, E = unknown>(callbackFn: () => T): ResultType<T, E> {
    try {
      return ResultImplementation.ok(callbackFn());
    } catch (e) {
      return ResultImplementation.error(e as E);
    }
  }

  static all<T, E>(iterable: Iterable<ResultType<T, E>>): ResultType<T[], E> {
    const values: T[] = [];
    for (const result of iterable) {
      if (!result.ok) {
        return result as ResultType<never, E>;
      }
      values.push(result.value);
    }
    return ResultImplementation.ok(values);
  }

  static from<T, E>(result: ResultLike<T, E>): ResultType<T, E> {
    return result.ok
      ? ResultImplementation.ok(result.value)
      : ResultImplementation.error(result.error);
  }

  static isResult(value: unknown): value is ResultType<unknown, unknown> {
    return value instanceof ResultImplementation;
  }

  // This is required to make the Newable signature work
  static get [Symbol.species]() {
    return ResultImplementation;
  }

  // Instance methods (implementing ResultPrototype)
  map<U>(fn: (value: T) => PromiseLike<U>): AsyncResultType<U, E>;
  map<U>(fn: (value: T) => U): ResultType<U, E>;
  map<U>(
    fn: (value: T) => U | PromiseLike<U>,
  ): ResultType<U, E> | AsyncResultType<U, E> {
    if (this.ok) {
      const mappedValue = fn(this.value!);
      if (
        mappedValue instanceof Promise ||
        (typeof mappedValue === "object" &&
          mappedValue !== null &&
          "then" in mappedValue)
      ) {
        return new AsyncResultImplementation<U, E>(
          (okCallback, errCallback) => {
            Promise.resolve(mappedValue)
              .then(okCallback)
              .catch((reason) => errCallback(reason as E));
          },
        );
      }
      return ResultImplementation.ok(mappedValue);
    }
    return this as unknown as ResultType<U, E>;
  }

  flatMap<U, F = E>(
    fn: (value: T) => PromiseLike<ResultType<U, F>>,
  ): AsyncResultType<U, F>;
  flatMap<U, F = E>(fn: (value: T) => ResultType<U, F>): ResultType<U, F>;
  flatMap<U, F = E>(
    fn: (value: T) => ResultType<U, F> | PromiseLike<ResultType<U, F>>,
  ): ResultType<U, F> | AsyncResultType<U, F> {
    if (this.ok) {
      const flatMappedResult = fn(this.value!);
      if (
        flatMappedResult instanceof Promise ||
        (typeof flatMappedResult === "object" &&
          flatMappedResult !== null &&
          "then" in flatMappedResult)
      ) {
        return new AsyncResultImplementation<U, F>(
          (okCallback, errCallback) => {
            Promise.resolve(flatMappedResult)
              .then((result) => {
                if (result.ok) {
                  okCallback(result.value);
                } else {
                  errCallback(result.error);
                }
              })
              .catch((reason) => errCallback(reason as F));
          },
        );
      }
      return flatMappedResult;
    }
    return this as unknown as ResultType<U, F>;
  }

  mapError<F>(fn: (error: E) => PromiseLike<F>): AsyncResultType<T, F>;
  mapError<F>(fn: (error: E) => F): ResultType<T, F>;
  mapError<F>(
    fn: (error: E) => F | PromiseLike<F>,
  ): ResultType<T, F> | AsyncResultType<T, F> {
    if (!this.ok) {
      const mappedError = fn(this.error!);
      if (
        mappedError instanceof Promise ||
        (typeof mappedError === "object" &&
          mappedError !== null &&
          "then" in mappedError)
      ) {
        return new AsyncResultImplementation<T, F>(
          (okCallback, errCallback) => {
            Promise.resolve(mappedError)
              .then((newError) => errCallback(newError))
              .catch((reason) => errCallback(reason as F));
          },
        );
      }
      return ResultImplementation.error(mappedError);
    }
    return this as unknown as ResultType<T, F>;
  }

  flatMapError<U, F = E>(
    fn: (error: E) => PromiseLike<ResultType<U, F>>,
  ): AsyncResultType<U, F>;
  flatMapError<U, F = E>(fn: (error: E) => ResultType<U, F>): ResultType<U, F>;
  flatMapError<U, F = E>(
    fn: (error: E) => ResultType<U, F> | PromiseLike<ResultType<U, F>>,
  ): ResultType<U, F> | AsyncResultType<U, F> {
    if (!this.ok) {
      const flatMappedErrorResult = fn(this.error!);
      if (
        flatMappedErrorResult instanceof Promise ||
        (typeof flatMappedErrorResult === "object" &&
          flatMappedErrorResult !== null &&
          "then" in flatMappedErrorResult)
      ) {
        return new AsyncResultImplementation<U, F>(
          (okCallback, errCallback) => {
            Promise.resolve(flatMappedErrorResult)
              .then((result) => {
                if (result.ok) {
                  okCallback(result.value);
                } else {
                  errCallback(result.error);
                }
              })
              .catch((reason) => errCallback(reason as F));
          },
        );
      }
      return flatMappedErrorResult;
    }
    return this as unknown as ResultType<U, F>;
  }

  catch<U>(fn: (error: E) => PromiseLike<U>): AsyncResultType<T | U, never>;
  catch<U>(fn: (error: E) => U): ResultType<T | U, never>;
  catch<U>(
    fn: (error: E) => U | PromiseLike<U>,
  ): ResultType<T | U, never> | AsyncResultType<T | U, never> {
    if (!this.ok) {
      const caughtValue = fn(this.error!);
      if (
        caughtValue instanceof Promise ||
        (typeof caughtValue === "object" &&
          caughtValue !== null &&
          "then" in caughtValue)
      ) {
        return new AsyncResultImplementation<T | U, never>((okCallback) => {
          Promise.resolve(caughtValue).then(okCallback);
          // If the catch handler promise rejects, it will propagate as an unhandled rejection
          // This is consistent with Promise behavior
        });
      }
      return ResultImplementation.ok(caughtValue);
    }
    return this as unknown as ResultType<T | U, never>;
  }

  tap(onOk: (value: T) => PromiseLike<void>): AsyncResultType<T, E>;
  tap(onOk: (value: T) => void): ResultType<T, E>;
  tap(
    onOk: (value: T) => void | PromiseLike<void>,
  ): ResultType<T, E> | AsyncResultType<T, E> {
    if (this.ok) {
      const tapResult = onOk(this.value!);
      if (
        tapResult instanceof Promise ||
        (typeof tapResult === "object" &&
          tapResult !== null &&
          "then" in tapResult)
      ) {
        return new AsyncResultImplementation<T, E>(
          (okCallback, errCallback) => {
            Promise.resolve(tapResult)
              .then(() => okCallback(this.value!))
              .catch((reason) => errCallback(reason as E));
          },
        );
      }
    }
    return this as ResultType<T, E>;
  }

  tapError(onError: (error: E) => PromiseLike<void>): AsyncResultType<T, E>;
  tapError(onError: (error: E) => void): ResultType<T, E>;
  tapError(
    onError: (error: E) => void | PromiseLike<void>,
  ): ResultType<T, E> | AsyncResultType<T, E> {
    if (!this.ok) {
      const tapErrorResult = onError(this.error!);
      if (
        tapErrorResult instanceof Promise ||
        (typeof tapErrorResult === "object" &&
          tapErrorResult !== null &&
          "then" in tapErrorResult)
      ) {
        return new AsyncResultImplementation<T, E>(
          (okCallback, errCallback) => {
            Promise.resolve(tapErrorResult)
              .then(() => errCallback(this.error!)) // Still propagate original error if tapError succeeds
              .catch((reason) => okCallback(reason as T)); // If tapError promise rejects, it becomes an Ok value
          },
        );
      }
    }
    return this as ResultType<T, E>;
  }

  finally(onFinally: () => PromiseLike<void>): AsyncResultType<T, E>;
  finally(onFinally: () => void): ResultType<T, E>;
  finally(
    onFinally: () => void | PromiseLike<void>,
  ): ResultType<T, E> | AsyncResultType<T, E> {
    const onFinallyResult = onFinally();
    if (
      onFinallyResult instanceof Promise ||
      (typeof onFinallyResult === "object" &&
        onFinallyResult !== null &&
        "then" in onFinallyResult)
    ) {
      return new AsyncResultImplementation<T, E>((okCallback, errCallback) => {
        Promise.resolve(onFinallyResult).then(() => {
          if (this.ok) {
            okCallback(this.value!);
          } else {
            errCallback(this.error!);
          }
        });
      });
    }
    // if the side effect does not return a promise, just execute it and return the original result
    return this as ResultType<T, E>;
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

class AsyncResultImplementation<T, E = unknown>
  implements AsyncResultType<T, E>
{
  private _promise: Promise<ResultType<T, E>>;

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
  static ok<T>(value: T): AsyncResultType<T, never> {
    return new AsyncResultImplementation<T, never>((ok) => ok(value));
  }

  static error<E>(error: E): AsyncResultType<never, E> {
    return new AsyncResultImplementation<never, E>((_, err) => err(error));
  }

  static try<T, E = unknown>(
    callbackFn: () => T | Promise<T>,
  ): AsyncResultType<T, E> {
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
    iterable: Iterable<T | AsyncResultType<T, E>>,
  ): AsyncResultType<T[], E> {
    const promises = Array.from(iterable).map((item) => {
      if (AsyncResultImplementation.isAsyncResult(item)) {
        return item.then((result) => result);
      } else {
        return Promise.resolve(ResultImplementation.ok(item as T));
      }
    });

    return new AsyncResultImplementation<T[], E>((ok, err) => {
      Promise.all(promises)
        .then((results) => {
          const allResults = ResultImplementation.all(results);
          if (allResults.ok) {
            ok(allResults.value);
          } else {
            err(allResults.error);
          }
        })
        .catch((e) => err(e as E));
    });
  }

  static from<T, E = unknown>(
    result: ResultLike<T, E> | Promise<ResultLike<T, E>>,
  ): AsyncResultType<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      Promise.resolve(result).then((r) => {
        if (r.ok) {
          ok(r.value);
        } else {
          err(r.error);
        }
      });
    });
  }

  static fromPromise<T, E = unknown>(
    promise: Promise<T>,
    mapErrorFn?: (reason: unknown) => E,
  ): AsyncResultType<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      promise.then(
        (value) => ok(value),
        (reason) => err(mapErrorFn ? mapErrorFn(reason) : (reason as E)),
      );
    });
  }

  static isAsyncResult(
    asyncResult: unknown,
  ): asyncResult is AsyncResultType<unknown, unknown> {
    return asyncResult instanceof AsyncResultImplementation;
  }

  // This is required to make the Newable signature work
  static get [Symbol.species]() {
    return AsyncResultImplementation;
  }

  // Instance methods
  then<TResult1 = ResultType<T, E>, TResult2 = never>(
    onfulfilled?:
      | ((value: ResultType<T, E>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected);
  }

  map<U>(callbackFn: (value: T) => U | PromiseLike<U>): AsyncResultType<U, E> {
    return new AsyncResultImplementation<U, E>((ok, err) => {
      this._promise.then((result) => {
        if (result.ok) {
          Promise.resolve(callbackFn(result.value))
            .then(ok)
            .catch((reason) => err(reason as E));
        } else {
          err(result.error);
        }
      });
    });
  }

  flatMap<U, F = E>(
    callbackFn: (value: T) => AsyncResultType<U, F>,
  ): AsyncResultType<U, F> {
    return new AsyncResultImplementation<U, F>((ok, err) => {
      this._promise.then((result) => {
        if (result.ok) {
          callbackFn(result.value).then((innerResult) => {
            if (innerResult.ok) {
              ok(innerResult.value);
            } else {
              err(innerResult.error);
            }
          });
        } else {
          // Need to cast the error to F since we're changing the error type
          err(result.error as unknown as F);
        }
      });
    });
  }

  mapError<F>(
    callbackFn: (error: E) => F | PromiseLike<F>,
  ): AsyncResultType<T, F> {
    return new AsyncResultImplementation<T, F>((ok, err) => {
      this._promise.then((result) => {
        if (!result.ok) {
          Promise.resolve(callbackFn(result.error))
            .then(err)
            .catch((reason) => ok(reason as T));
        } else {
          ok(result.value);
        }
      });
    });
  }

  flatMapError<U, F = E>(
    callbackFn: (error: E) => AsyncResultType<U, F>,
  ): AsyncResultType<U, F> {
    return new AsyncResultImplementation<U, F>((ok, err) => {
      this._promise.then((result) => {
        if (!result.ok) {
          callbackFn(result.error).then((innerResult) => {
            if (innerResult.ok) {
              ok(innerResult.value);
            } else {
              err(innerResult.error);
            }
          });
        } else {
          // Need to cast the value to U since we're changing the value type
          ok(result.value as unknown as U);
        }
      });
    });
  }

  catch<U>(
    callbackFn: (error: E) => U | PromiseLike<U>,
  ): AsyncResultType<U, never> {
    return new AsyncResultImplementation<U, never>((ok, err) => {
      this._promise.then((result) => {
        if (!result.ok) {
          Promise.resolve(callbackFn(result.error))
            .then(ok)
            .catch((reason) => {
              // When using never as the error type, we need to handle this specially
              // Since nothing can be assigned to never, we'll just throw the error
              throw reason;
            });
        } else {
          // Need to cast the value to U since we're changing the value type
          ok(result.value as unknown as U);
        }
      });
    });
  }

  tap(onOk: (value: T) => void | PromiseLike<void>): AsyncResultType<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      this._promise.then((result) => {
        if (result.ok) {
          Promise.resolve(onOk(result.value))
            .then(() => ok(result.value))
            .catch((reason) => err(reason as E));
        } else {
          err(result.error);
        }
      });
    });
  }

  tapError(
    onError: (error: E) => void | PromiseLike<void>,
  ): AsyncResultType<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      this._promise.then((result) => {
        if (!result.ok) {
          Promise.resolve(onError(result.error))
            .then(() => err(result.error))
            .catch((reason) => ok(reason as T));
        } else {
          ok(result.value);
        }
      });
    });
  }

  finally(onFinally: () => void | PromiseLike<void>): AsyncResultType<T, E> {
    return new AsyncResultImplementation<T, E>((ok, err) => {
      this._promise.then((result) => {
        Promise.resolve(onFinally())
          .then(() => {
            if (result.ok) {
              ok(result.value);
            } else {
              err(result.error);
            }
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
      if (result.ok) {
        return await Promise.resolve(onOk(result.value));
      } else {
        return await Promise.resolve(onError(result.error));
      }
    });
  }

  get [Symbol.toStringTag](): "AsyncResult" {
    return "AsyncResult";
  }
}

export const Result: ResultConstructor =
  ResultImplementation as unknown as ResultConstructor;
export const AsyncResult: AsyncResultConstructor =
  AsyncResultImplementation as unknown as AsyncResultConstructor;
