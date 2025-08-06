import { describe, expect, test } from "vitest";
import { all, error, flatMap, map, mapError, ok, tap, tapBoth, tryCatch } from "./dualResult2";
import * as Result from "./dualResult2";
import { pipe } from "effect";

describe("coretests", async () => {
    const validatedUsername = Result.tap(
        Result.all([
            Result.tapBoth(
                Result.mapError(
                    Result.map(
                        Result.flatMap(
                            Result.flatMap(Result.ok("zuck" as const), (username) => {
                                return Result.flatMap(
                                    Result.try(() => {
                                        if (username.length === 0)
                                            return Result.error("EMPTY_USERNAME" as const);
                                        if (username.length < 2)
                                            return Result.error("USERNAME_TOO_SHORT" as const);

                                        return Result.ok(username);
                                    }),
                                    (x) => x,
                                );
                            }),
                            (x) => {
                                return Result.ok(x.toUpperCase() as Uppercase<typeof x>);
                            },
                        ),
                        (x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const,
                    ),
                    (error) => `Error is: ${error}` as const,
                ),
                (v) => {
                    console.log(`Tapped that with value: ${JSON.stringify(v, null, 2)}`);
                },
            ),
        ] as const),
        (x) => console.log(x),
    );

    console.log("Final result:", validatedUsername);

    test("test2", () => {
        expect(validatedUsername).toEqual(
            Result.ok(["user is zuck" as const]),
        );
    });

    describe("pipe", () => {
        test("sync pipe", () => {
            const result = Result.pipe(
                Result.ok("zuck" as const),
                Result.flatMap((username) => {
                    if (username.length === 0) return Result.error("EMPTY_USERNAME" as const);
                    if (username.length < 2) return Result.error("USERNAME_TOO_SHORT" as const);
                    return Result.ok(username);
                }),
                Result.flatMap((x) => Result.ok(x.toUpperCase() as Uppercase<typeof x>)),
                Result.map((x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const),
                Result.mapError((error) => `Error is: ${error}` as const),
                Result.tapBoth((v) => {
                    console.log(`Tapped that with value: ${JSON.stringify(v, null, 2)}`);
                }),
            );

            expect(result).toEqual(Result.ok("user is zuck" as const))
        });

        test("async pipe", async () => {
            const result = Result.pipe(
                Result.ok("zuck" as const),
                Result.flatMap(async (username) => {
                    if (username.length === 0) return Result.error("EMPTY_USERNAME" as const);
                    if (username.length < 2) return Result.error("USERNAME_TOO_SHORT" as const);
                    return Result.ok(username);
                }),
                Result.flatMap((x) => Result.ok(x.toUpperCase() as Uppercase<typeof x>)),
                Result.map((x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const),
                Result.mapError((error) => `Error is: ${error}` as const),
                Result.tapBoth((v) => {
                    console.log(`Final value is: ${JSON.stringify(v, null, 2)}`);
                }),
            );

            expect(result).toBeInstanceOf(Promise);
            const res = await result;
            expect(res).toStrictEqual(Result.ok("user is zuck" as const));
            console.log("val", JSON.stringify(await result, null, 2));
        });
    });

    async function fetchRandomPokemon() {
        const id = Math.floor(Math.random() * 898) + 1 // 1 to 898 (Gen 1 to 8)
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
        if (!res.ok) throw new Error(`Failed to fetch Pokémon: ${res.status}`)
        return res.json() as Promise<{ name: string; id: number; weight: number }>;
    }

    const safeFetchRandomPokemon = Result.mapError(Result.try(fetchRandomPokemon), ((err: any) => `Error fetching Pokémon: ${err.message}`));

    test("fetchRandomPokemon", async () => {
        const result = Result.pipe(
            safeFetchRandomPokemon,
            Result.flatMap((pokemon) => {
                if (!pokemon.name || !pokemon.id || !pokemon.weight) {
                    return Result.error("Invalid Pokémon data" as const);
                }
                return Result.ok(pokemon);
            }),
            Result.mapError((err) => `Error: ${err}` as const),
            Result.map((pokemon) => `Fetched Pokémon: ${pokemon.name} (ID: ${pokemon.id}, Weight: ${pokemon.weight})` as const),
            Result.tapBoth((v) => {
                console.log(`Tapped that with value: ${JSON.stringify(v, null, 2)}`);
            }),
        );

        expect(result).toBeInstanceOf(Promise);
        const res = await result;
        expect(res.ok).toBe(true);
        expect((res as any)?.value).toMatch(/Fetched Pokémon: \w+ \(ID: \d+, Weight: \d+\)/);
    })
    // validatedUsername.then((x) => {
    //     console.log("Final result:", x);
    // })
});