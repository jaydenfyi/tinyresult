import { describe, expect, test, vi } from "vitest";
import { Result, AsyncResult } from "./result.js";

describe(Result, () => {
  test("should be a constructor", () => {
    expect(Result).toBeInstanceOf(Function);
  });

  test("should have a static ok method", () => {
    expect(Result.ok).toBeInstanceOf(Function);
  });

  test("should have a static error method", () => {
    expect(Result.error).toBeInstanceOf(Function);
  });

  test("should have a prototype with the correct methods", () => {
    const result = Result.ok("test");
    expect(result.map).toBeInstanceOf(Function);
    expect(result.flatMap).toBeInstanceOf(Function);
    expect(result.mapError).toBeInstanceOf(Function);
    expect(result.flatMapError).toBeInstanceOf(Function);
    expect(result.catch).toBeInstanceOf(Function);
    expect(result.tap).toBeInstanceOf(Function);
    expect(result.tapError).toBeInstanceOf(Function);
    expect(result.finally).toBeInstanceOf(Function);
    expect(result.match).toBeInstanceOf(Function);
  });

  describe("Result.ok", () => {
    test("should create a Result with a value", () => {
      const result = Result.ok("value");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe("value");
    });
  });

  describe("Result.error", () => {
    test("should create a Result with an error", () => {
      const result = Result.error("error");
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe("error");
    });
  });

  describe("Result.try", () => {
    test("should return an ok result when the callback does not throw", () => {
      const result = Result.try(() => 5);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(5);
    });

    test("should return an error result when the callback throws", () => {
      const error = new Error("test error");
      const result = Result.try(() => {
        throw error;
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe(error);
    });
  });

  describe("Result.all", () => {
    test("should return an ok result with all values if all results are ok", () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)];
      const result = Result.all(results);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toEqual([1, 2, 3]);
    });

    test("should return the first error result if any result is an error", () => {
      const error = new Error("test error");
      const results = [Result.ok(1), Result.error(error), Result.ok(3)];
      const result = Result.all(results);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe(error);
    });
  });

  describe("Result.from", () => {
    test("should create an ok result from an ok-like object", () => {
      const result = Result.from({ ok: true, value: 5 });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(5);
    });

    test("should create an error result from an error-like object", () => {
      const error = new Error("test error");
      const result = Result.from({ ok: false, error });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe(error);
    });
  });

  describe("Result.isResult", () => {
    test("should return true for a Result instance", () => {
      const result = Result.ok(5);
      expect(Result.isResult(result)).toBe(true);
    });

    test("should return false for a non-Result value", () => {
      expect(Result.isResult({ ok: true, value: 5 })).toBe(false);
      expect(Result.isResult(null)).toBe(false);
      expect(Result.isResult(undefined)).toBe(false);
    });
  });

  describe("Result.prototype.map", () => {
    test("should apply the callback to the value if ok", () => {
      const result = Result.ok(5);
      const mapped = result.map((value) => value * 2);
      expect(mapped.ok).toBe(true);
      if (!mapped.ok) throw new Error("Result should be ok");

      expect(mapped.value).toBe(10);
    });

    test("should not apply the callback if error", () => {
      const result = Result.error("error");
      const mapped = result.map((value) => value * 2);
      expect(mapped.ok).toBe(false);
      if (mapped.ok) throw new Error("Result should be an error");
      expect(mapped.error).toBe("error");
    });

    test("should return an AsyncResult if the map callback returns a promise", async () => {
      const result = Result.ok(5);
      const mapped = result.map(async (value) => value * 2);
      expect(AsyncResult.isAsyncResult(mapped)).toBe(true);
      const resolvedResult = await mapped;
      expect(resolvedResult.ok).toBe(true);
      if (!resolvedResult.ok) throw new Error("Result should be ok");
      expect(resolvedResult.value).toBe(10);
    });
  });

  describe("Result.prototype.flatMap", () => {
    test("should apply the callback and flatten the result if ok", () => {
      const result = Result.ok(5);
      const flatMapped = result.flatMap((value) => Result.ok(value * 2));
      expect(flatMapped.ok).toBe(true);
      if (!flatMapped.ok) throw new Error("Result should be ok");
      expect(flatMapped.value).toBe(10);
    });

    test("should not apply the callback if error", () => {
      const result = Result.error("error");
      const flatMapped = result.flatMap((value) => Result.ok(value * 2));
      expect(flatMapped.ok).toBe(false);
      if (flatMapped.ok) throw new Error("Result should be an error");
      expect(flatMapped.error).toBe("error");
    });

    test("should return an AsyncResult if the flatMap callback returns a promise", async () => {
      const result = Result.ok(5);
      const flatMapped = result.flatMap(async (value) => Result.ok(value * 2));
      expect(AsyncResult.isAsyncResult(flatMapped)).toBe(true);
      const resolvedResult = await flatMapped;
      expect(resolvedResult.ok).toBe(true);
      if (!resolvedResult.ok) throw new Error("Result should be ok");
      expect(resolvedResult.value).toBe(10);
    });
  });

  describe("Result.prototype.mapError", () => {
    test("should apply the callback to the error if error", () => {
      const result = Result.error("error");
      const mappedError = result.mapError((error) => `Mapped: ${error}`);
      expect(mappedError.ok).toBe(false);
      if (mappedError.ok) throw new Error("Result should be an error");
      expect(mappedError.error).toBe("Mapped: error");
    });

    test("should not apply the callback if ok", () => {
      const result = Result.ok(5);
      const mappedError = result.mapError((error) => `Mapped: ${error}`);
      expect(mappedError.ok).toBe(true);
      if (!mappedError.ok) throw new Error("Result should be ok");
      expect(mappedError.value).toBe(5);
    });

    test("should return an AsyncResult if the mapError callback returns a promise", async () => {
      const result = Result.error("error");
      const mappedError = result.mapError(async (error) => `Mapped: ${error}`);
      expect(AsyncResult.isAsyncResult(mappedError)).toBe(true);
      const resolvedResult = await mappedError;
      expect(resolvedResult.ok).toBe(false);
      if (resolvedResult.ok) throw new Error("Result should be an error");
      expect(resolvedResult.error).toBe("Mapped: error");
    });
  });

  describe("Result.prototype.flatMapError", () => {
    test("should apply the callback and flatten the result if error", () => {
      const result = Result.error("error");
      const flatMappedError = result.flatMapError((error) =>
        Result.error(`Mapped: ${error}`),
      );
      expect(flatMappedError.ok).toBe(false);
      if (flatMappedError.ok) throw new Error("Result should be an error");
      expect(flatMappedError.error).toBe("Mapped: error");
    });

    test("should not apply the callback if ok", () => {
      const result = Result.ok(5);
      const flatMappedError = result.flatMapError((error) =>
        Result.error(`Mapped: ${error}`),
      );
      expect(flatMappedError.ok).toBe(true);
      if (!flatMappedError.ok) throw new Error("Result should be ok");
      expect(flatMappedError.value).toBe(5);
    });

    test("should return an AsyncResult if the flatMapError callback returns a promise", async () => {
      const result = Result.error("error");
      const flatMappedError = result.flatMapError(async (error) =>
        Result.error(`Mapped: ${error}`),
      );
      expect(AsyncResult.isAsyncResult(flatMappedError)).toBe(true);
      const resolvedResult = await flatMappedError;
      expect(resolvedResult.ok).toBe(false);
      if (resolvedResult.ok) throw new Error("Result should be an error");
      expect(resolvedResult.error).toBe("Mapped: error");
    });
  });

  describe("Result.prototype.catch", () => {
    test("should apply the callback to the error if error", () => {
      const result = Result.error("error");
      const caught = result.catch((error) => `Caught: ${error}`);
      expect(caught.ok).toBe(true);
      if (!caught.ok) throw new Error("Result should be ok");
      expect(caught.value).toBe("Caught: error");
    });

    test("should not apply the callback if ok", () => {
      const result = Result.ok(5);
      const caught = result.catch((error) => `Caught: ${error}`);
      expect(caught.ok).toBe(true);
      if (!caught.ok) throw new Error("Result should be ok");
      expect(caught.value).toBe(5);
    });

    test("should return an AsyncResult if the catch callback returns a promise", async () => {
      const result = Result.error("error");
      const caught = result.catch(async (error) => `Caught: ${error}`);
      expect(AsyncResult.isAsyncResult(caught)).toBe(true);
      const resolvedResult = await caught;
      expect(resolvedResult.ok).toBe(true);
      if (!resolvedResult.ok) throw new Error("Result should be ok");
      expect(resolvedResult.value).toBe("Caught: error");
    });
  });

  describe("Result.prototype.tap", () => {
    test("should call the callback if ok", () => {
      const result = Result.ok(5);
      const spy = vi.fn();
      result.tap(spy);
      expect(spy).toHaveBeenCalledWith(5);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(5);
    });

    test("should not call the callback if error", () => {
      const result = Result.error("error");
      const spy = vi.fn();
      result.tap(spy);
      expect(spy).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe("error");
    });
  });

  test("should return an AsyncResult if the tap callback returns a promise", async () => {
    const result = Result.ok(5);
    const tapped = result.tap(async () => {});
    expect(AsyncResult.isAsyncResult(tapped)).toBe(true);
    const resolvedResult = await tapped;
    expect(resolvedResult.ok).toBe(true);
    if (!resolvedResult.ok) throw new Error("Result should be ok");
    expect(resolvedResult.value).toBe(5);
  });

  describe("Result.prototype.tapError", () => {
    test("should call the callback if error", () => {
      const result = Result.error("error");
      const spy = vi.fn();
      result.tapError(spy);
      expect(spy).toHaveBeenCalledWith("error");
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe("error");
    });

    test("should not call the callback if ok", () => {
      const result = Result.ok(5);
      const spy = vi.fn();
      result.tapError(spy);
      expect(spy).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(5);
    });

    test("should return an AsyncResult if the tapError callback returns a promise", async () => {
      const result = Result.error("error");
      const tapped = result.tapError(async () => {});
      expect(AsyncResult.isAsyncResult(tapped)).toBe(true);
      const resolvedResult = await tapped;
      expect(resolvedResult.ok).toBe(false);
      if (resolvedResult.ok) throw new Error("Result should be an error");
      expect(resolvedResult.error).toBe("error");
    });
  });

  describe("Result.prototype.finally", () => {
    test("should call the callback regardless of ok or error", () => {
      const resultOk = Result.ok(5);
      const resultError = Result.error("error");
      const spy = vi.fn();

      resultOk.finally(spy);
      expect(spy).toHaveBeenCalled();
      expect(resultOk.ok).toBe(true);
      if (!resultOk.ok) throw new Error("Result should be ok");
      expect(resultOk.value).toBe(5);

      spy.mockClear(); // Clear the spy for the next test

      resultError.finally(spy);
      expect(spy).toHaveBeenCalled();
      expect(resultError.ok).toBe(false);
      if (resultError.ok) throw new Error("Result should be an error");
      expect(resultError.error).toBe("error");
    });

    test("should return an AsyncResult if the finally callback returns a promise", async () => {
      const result = Result.ok(5);
      const final = result.finally(async () => {});
      expect(AsyncResult.isAsyncResult(final)).toBe(true);
      const resolvedResult = await final;
      expect(resolvedResult.ok).toBe(true);
      if (!resolvedResult.ok) throw new Error("Result should be ok");
      expect(resolvedResult.value).toBe(5);
    });
  });

  describe("Result.prototype.match", () => {
    test("should return the value from onOk if ok", () => {
      const result = Result.ok("value");
      const matched = result.match(
        (value) => `Ok: ${value}`,
        (error) => `Error: ${error}`,
      );
      expect(matched).toBe("Ok: value");
    });

    test("should return the value from onError if error", () => {
      const result = Result.error("error");
      const matched = result.match(
        (value) => `Ok: ${value}`,
        (error) => `Error: ${error}`,
      );
      expect(matched).toBe("Error: error");
    });

    test("should handle every prototype method in one chain", () => {
      const result = Result.ok(5)
        .map((value) => value * 2)
        .flatMap((value) => Result.ok(value + 3))
        .mapError((error) => `Error: ${error}`)
        .tap((value) => console.log(`Value: ${value}`))
        .catch((error) => `Caught: ${error}`)
        .finally(() => console.log("Done"));

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(13);
    });
  });
});

describe(AsyncResult, () => {
  test("should be a constructor", () => {
    expect(AsyncResult).toBeInstanceOf(Function);
  });

  test("should have a static ok method", () => {
    expect(AsyncResult.ok).toBeInstanceOf(Function);
  });

  test("should have a static error method", () => {
    expect(AsyncResult.error).toBeInstanceOf(Function);
  });

  test("should have a prototype with the correct methods", () => {
    const result = AsyncResult.ok("test");
    expect(result.map).toBeInstanceOf(Function);
    expect(result.flatMap).toBeInstanceOf(Function);
    expect(result.mapError).toBeInstanceOf(Function);
    expect(result.flatMapError).toBeInstanceOf(Function);
    expect(result.catch).toBeInstanceOf(Function);
    expect(result.tap).toBeInstanceOf(Function);
    expect(result.tapError).toBeInstanceOf(Function);
    expect(result.finally).toBeInstanceOf(Function);
    expect(result.match).toBeInstanceOf(Function);
  });

  describe("AsyncResult.ok", () => {
    test("should create an AsyncResult with a value", async () => {
      const result = await AsyncResult.ok("value");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe("value");
    });
  });

  describe("AsyncResult.error", () => {
    test("should create an AsyncResult with an error", async () => {
      const result = await AsyncResult.error("error");
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe("error");
    });
  });

  describe("AsyncResult.try", () => {
    test("should create an ok AsyncResult from a synchronous function", async () => {
      const result = await AsyncResult.try(() => 5);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(5);
    });

    test("should create an ok AsyncResult from an async function", async () => {
      const result = await AsyncResult.try(async () => 5);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(5);
    });

    test("should create an error AsyncResult from a throwing synchronous function", async () => {
      const error = new Error("test error");
      const result = await AsyncResult.try(() => {
        throw error;
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe(error);
    });

    test("should create an error AsyncResult from a rejecting async function", async () => {
      const error = new Error("test error");
      const result = await AsyncResult.try(async () => {
        throw error;
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe(error);
    });
  });

  describe("AsyncResult.all", () => {
    test("should return an ok AsyncResult with all values if all results are ok", async () => {
      const results = [AsyncResult.ok(1), AsyncResult.ok(2), AsyncResult.ok(3)];
      const result = await AsyncResult.all(results);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toEqual([1, 2, 3]);
    });

    test("should return the first error AsyncResult if any result is an error", async () => {
      const error = new Error("test error");
      const results = [
        AsyncResult.ok(1),
        AsyncResult.error(error),
        AsyncResult.ok(3),
      ];
      const result = await AsyncResult.all(results);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe(error);
    });

    test("should handle a mix of AsyncResult and non-AsyncResult values", async () => {
      const results = [1, AsyncResult.ok(2), 3];
      const result = await AsyncResult.all(results);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toEqual([1, 2, 3]);
    });
  });

  describe("AsyncResult.from", () => {
    test("should create an ok AsyncResult from an ok-like object", async () => {
      const result = await AsyncResult.from({ ok: true, value: 5 });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(5);
    });

    test("should create an error AsyncResult from an error-like object", async () => {
      const error = new Error("test error");
      const result = await AsyncResult.from({ ok: false, error });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe(error);
    });

    test("should create an ok AsyncResult from a promise of an ok-like object", async () => {
      const result = await AsyncResult.from(
        Promise.resolve({ ok: true, value: 5 }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(5);
    });
  });

  describe("AsyncResult.fromPromise", () => {
    test("should create an ok AsyncResult from a resolving promise", async () => {
      const result = await AsyncResult.fromPromise(Promise.resolve(5));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(5);
    });

    test("should create an error AsyncResult from a rejecting promise", async () => {
      const error = new Error("test error");
      const result = await AsyncResult.fromPromise(Promise.reject(error));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe(error);
    });

    test("should map the error if a mapErrorFn is provided", async () => {
      const error = new Error("test error");
      const result = await AsyncResult.fromPromise(
        Promise.reject(error),
        (e) => `Mapped: ${(e as Error).message}`,
      );
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Result should be an error");
      expect(result.error).toBe("Mapped: test error");
    });
  });

  describe("AsyncResult.isAsyncResult", () => {
    test("should return true for an AsyncResult instance", () => {
      const result = AsyncResult.ok(5);
      expect(AsyncResult.isAsyncResult(result)).toBe(true);
    });

    test("should return false for a non-AsyncResult value", () => {
      expect(AsyncResult.isAsyncResult(Result.ok(5))).toBe(false);
      expect(AsyncResult.isAsyncResult(null)).toBe(false);
      expect(AsyncResult.isAsyncResult(undefined)).toBe(false);
    });
  });

  describe("AsyncResult.prototype.map", () => {
    test("should apply the callback to the value if ok", async () => {
      const result = AsyncResult.ok(5);
      const mapped = await result.map((value) => value * 2);
      expect(mapped.ok).toBe(true);
      if (!mapped.ok) throw new Error("Result should be ok");
      expect(mapped.value).toBe(10);
    });

    test("should not apply the callback if error", async () => {
      const result = AsyncResult.error("error");
      const mapped = await result.map((value) => value * 2);
      expect(mapped.ok).toBe(false);
      if (mapped.ok) throw new Error("Result should be an error");
      expect(mapped.error).toBe("error");
    });
  });

  describe("AsyncResult.prototype.flatMap", () => {
    test("should apply the callback and flatten the result if ok", async () => {
      const result = AsyncResult.ok(5);
      const flatMapped = await result.flatMap((value) =>
        AsyncResult.ok(value * 2),
      );
      expect(flatMapped.ok).toBe(true);
      if (!flatMapped.ok) throw new Error("Result should be ok");
      expect(flatMapped.value).toBe(10);
    });

    test("should not apply the callback if error", async () => {
      const result = AsyncResult.error("error");
      const flatMapped = await result.flatMap((value) =>
        AsyncResult.ok(value * 2),
      );
      expect(flatMapped.ok).toBe(false);
      if (flatMapped.ok) throw new Error("Result should be an error");
      expect(flatMapped.error).toBe("error");
    });

    test("should handle an ok result being passed to an error flatMap", async () => {
      const result = AsyncResult.ok(5);
      const flatMapped = await result.flatMapError((error) =>
        AsyncResult.error(`Mapped: ${error}`),
      );
      expect(flatMapped.ok).toBe(true);
      if (!flatMapped.ok) throw new Error("Result should be ok");
      expect(flatMapped.value).toBe(5);
    });
  });

  describe("AsyncResult.prototype.mapError", () => {
    test("should apply the callback to the error if error", async () => {
      const result = AsyncResult.error("error");
      const mappedError = await result.mapError((error) => `Mapped: ${error}`);
      expect(mappedError.ok).toBe(false);
      if (mappedError.ok) throw new Error("Result should be an error");
      expect(mappedError.error).toBe("Mapped: error");
    });

    test("should not apply the callback if ok", async () => {
      const result = AsyncResult.ok(5);
      const mappedError = await result.mapError((error) => `Mapped: ${error}`);
      expect(mappedError.ok).toBe(true);
      if (!mappedError.ok) throw new Error("Result should be ok");
      expect(mappedError.value).toBe(5);
    });
  });

  describe("AsyncResult.prototype.flatMapError", () => {
    test("should apply the callback and flatten the result if error", async () => {
      const result = AsyncResult.error("error");
      const flatMappedError = await result.flatMapError((error) =>
        AsyncResult.error(`Mapped: ${error}`),
      );
      expect(flatMappedError.ok).toBe(false);
      if (flatMappedError.ok) throw new Error("Result should be an error");
      expect(flatMappedError.error).toBe("Mapped: error");
    });

    test("should not apply the callback if ok", async () => {
      const result = AsyncResult.ok(5);
      const flatMappedError = await result.flatMapError((error) =>
        AsyncResult.error(`Mapped: ${error}`),
      );
      expect(flatMappedError.ok).toBe(true);
      if (!flatMappedError.ok) throw new Error("Result should be ok");
      expect(flatMappedError.value).toBe(5);
    });
  });

  describe("AsyncResult.prototype.catch", () => {
    test("should apply the callback to the error if error", async () => {
      const result = AsyncResult.error("error");
      const caught = await result.catch((error) => `Caught: ${error}`);
      expect(caught.ok).toBe(true);
      if (!caught.ok) throw new Error("Result should be ok");
      expect(caught.value).toBe("Caught: error");
    });

    test("should not apply the callback if ok", async () => {
      const result = AsyncResult.ok(5);
      const caught = await result.catch((error) => `Caught: ${error}`);
      expect(caught.ok).toBe(true);
      if (!caught.ok) throw new Error("Result should be ok");
      expect(caught.value).toBe(5);
    });
  });

  describe("AsyncResult.prototype.tap", () => {
    test("should call the callback if ok", async () => {
      const result = await AsyncResult.ok(5);
      const spy = vi.fn();
      await result.tap(spy);
      expect(spy).toHaveBeenCalledWith(5);
    });

    test("should not call the callback if error", async () => {
      const result = await AsyncResult.error("error");
      const spy = vi.fn();
      await result.tap(spy);
      expect(spy).not.toHaveBeenCalled();
    });

    test("should handle a rejecting promise from the callback", async () => {
      const error = new Error("test error");
      const result = AsyncResult.ok(5);
      const tapped = await result.tap(() => Promise.reject(error));
      expect(tapped.ok).toBe(false);
      if (tapped.ok) throw new Error("Result should be an error");
      expect(tapped.error).toBe(error);
    });
  });

  describe("AsyncResult.prototype.tapError", () => {
    test("should call the callback if error", async () => {
      const result = await AsyncResult.error("error");
      const spy = vi.fn();
      await result.tapError(spy);
      expect(spy).toHaveBeenCalledWith("error");
    });

    test("should not call the callback if ok", async () => {
      const result = await AsyncResult.ok(5);
      const spy = vi.fn();
      await result.tapError(spy);
      expect(spy).not.toHaveBeenCalled();
    });

    test("should handle a rejecting promise from the callback", async () => {
      const error = new Error("test error");
      const result = AsyncResult.error("some error");
      const tapped = await result.tapError(() => Promise.reject(error));
      expect(tapped.ok).toBe(true);
      if (!tapped.ok) throw new Error("Result should be ok");
      expect(tapped.value).toBe(error);
    });
  });

  describe("AsyncResult.prototype.finally", () => {
    test("should call the callback regardless of ok or error", async () => {
      const resultOk = AsyncResult.ok(5);
      const resultError = AsyncResult.error("error");
      const spy = vi.fn();

      await resultOk.finally(spy);
      expect(spy).toHaveBeenCalled();

      spy.mockClear();

      await resultError.finally(spy);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("AsyncResult.prototype.match", () => {
    test("should return the value from onOk if ok", async () => {
      const result = AsyncResult.ok("value");
      const matched = await result.match(
        (value) => `Ok: ${value}`,
        (error) => `Error: ${error}`,
      );
      expect(matched).toBe("Ok: value");
    });

    test("should return the value from onError if error", async () => {
      const result = AsyncResult.error("error");
      const matched = await result.match(
        (value) => `Ok: ${value}`,
        (error) => `Error: ${error}`,
      );
      expect(matched).toBe("Error: error");
    });

    test("should have a then method that allows awaiting", async () => {
      const result = await AsyncResult.ok(5);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Result should be ok");
      expect(result.value).toBe(5);
    });

    test("should have the correct string tag", () => {
      const result = AsyncResult.ok(5);
      expect(Object.prototype.toString.call(result)).toBe(
        "[object AsyncResult]",
      );
    });
  });

  describe("Result.prototype[Symbol.toStringTag]", () => {
    test("should have the correct string tag", () => {
      const result = Result.ok(5);
      expect(Object.prototype.toString.call(result)).toBe("[object Result]");
    });
  });
});
