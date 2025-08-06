import { describe, expect, test } from "vitest";
import { all, error, flatMap, map, mapError, ok, tap, tapBoth, tryCatch } from "./dualResult2";
import { pipe } from "effect";

describe("coretests", async () => {
    const validatedUsername = tap(
        all([
            tapBoth(
                mapError(
                    map(
                        flatMap(
                            flatMap(ok("zuck" as const), (username) => {
                                return flatMap(
                                    tryCatch(() => {
                                        if (username.length === 0)
                                            return error("EMPTY_USERNAME" as const);
                                        if (username.length < 2)
                                            return error("USERNAME_TOO_SHORT" as const);

                                        return ok(username);
                                    }),
                                    (x) => x,
                                );
                            }),
                            (x) => {
                                return ok(x.toUpperCase() as Uppercase<typeof x>);
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
            ok(["user is zuck" as const]),
        );
    });

    describe("pipe", () => {
        test("sync pipe", () => {
            const result = pipe(
                ok("zuck" as const),
                flatMap((username) => {
                    if (username.length === 0) return error("EMPTY_USERNAME" as const);
                    if (username.length < 2) return error("USERNAME_TOO_SHORT" as const);
                    return ok(username);
                }),
                flatMap((x) => ok(x.toUpperCase() as Uppercase<typeof x>)),
                map((x) => `user is ${x.toLowerCase() as Lowercase<typeof x>}` as const),
                mapError((error) => `Error is: ${error}` as const),
                tapBoth((v) => {
                    console.log(`Tapped that with value: ${JSON.stringify(v, null, 2)}`);
                }),
            );

            expect(result).toEqual(ok("user is zuck" as const))
        });

        test("async pipe", async () => {
            const result = pipe(
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
                    console.log(`Tapped that with value: ${JSON.stringify(v, null, 2)}`);
                }),
            );

            expect(result).toBeInstanceOf(Promise);
            const res = await result;
            expect(res).toStrictEqual(ok("user is zuck" as const));
            console.log("val", JSON.stringify(await result, null, 2));
        });
    });

    async function fetchRandomPokemon() {
        const id = Math.floor(Math.random() * 898) + 1 // 1 to 898 (Gen 1 to 8)
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
        if (!res.ok) throw new Error(`Failed to fetch Pokémon: ${res.status}`)
        return res.json() as Promise<{ name: string; id: number; weight: number }>;
    }

    const safeFetchRandomPokemon = mapError(tryCatch(fetchRandomPokemon), ((err: any) => `Error fetching Pokémon: ${err.message}`));

    test("fetchRandomPokemon", async () => {
        const result = pipe(
            safeFetchRandomPokemon,
            flatMap((pokemon) => {
                if (!pokemon.name || !pokemon.id || !pokemon.weight) {
                    return error("Invalid Pokémon data" as const);
                }
                return ok(pokemon);
            }),
            mapError((err) => `Error: ${err}` as const),
            map((pokemon) => `Fetched Pokémon: ${pokemon.name} (ID: ${pokemon.id}, Weight: ${pokemon.weight})` as const),
            tapBoth((v) => {
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