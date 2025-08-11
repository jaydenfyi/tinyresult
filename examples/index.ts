import { AsyncResult, Result } from "../src/index.js";

const userNames = AsyncResult.ok([
    { id: 1, name: "Alice", age: 30 },
    { id: 2, name: "Bob", age: 25 },
    { id: 3, name: "Charlie", age: 16 },
] as const)
    .flatMap(validateUsers)
    .tapError((error) => {
        if (error === "No users found") {
            console.error("Error: No users found");
        }
    })
    .flatMap(
        function getUserNames(users) {
            return Result.ok(users.map((user) => user.name));
        })
    .flatMap(function validateArrayLength(names) {
        if (names.length === 0) {
            return Result.error("No user names found" as const);
        }

        return Result.ok(names);
    })
    .match((names) => {
        console.log("User names:", names);
        return names;
    }, (error) => {
        console.error("Error:", error);
        throw new Error(error);
    });

function validateUsers<T extends readonly { id: number; name: string; age: number; }[]>(users: T) {
    if (users.length === 0) {
        return Result.error("No users found" as const);
    }

    if (users.some((user) => user.name === "Bob")) {
        return Result.error("Bob is not allowed" as const);
    }

    if (users.some((user) => user.age < 18)) {
        return Result.error("Some users are under 18" as const);
    }

    return Result.ok(users);
}
