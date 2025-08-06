import * as Result from "../src/pipe/index.js";
import { pipe } from "effect";

import * as AsyncResult from "../src/core/resultAsync.js"

const asyncValidatedUsername = await AsyncResult.match(
    AsyncResult.flatMap(
        AsyncResult.ok("Alice" as const),
        (username) => {
            if (username.toString() === "Bob") {
                return Result.error("USERNAME_BOB_NOT_ALLOWED" as const);
            }
            return Result.error("USERNAME_NOT_ALPHANUMERIC" as const);
        }
    ),
    (username) => `Username is valid: ${username}` as const,
    (error) => `Error: ${error}` as const,
);