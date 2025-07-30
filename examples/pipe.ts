import { pipe } from "effect";
import * as Result from "../src/pipe/resultAsync.js";

const validatedUsername = pipe(
    Result.ok("zuck" as const),
    Result.flatMap((username) => {
        if (username.length === 0) {
            return Result.error("EMPTY_USERNAME" as const);
        }

        if (username.length < 2) {
            return Result.error("USERNAME_TOO_SHORT" as const);
        }

        return Result.ok(username);
    }),
    Result.flatMap((username) => {
        return Promise.resolve(Result.ok(username));
    }),
    Result.flatMap((username) => Result.ok(`Username is valid: ${username}` as const)),
);
