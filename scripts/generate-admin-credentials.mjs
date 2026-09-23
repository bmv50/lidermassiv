import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = randomBytes(24).toString("base64url");
const salt = randomBytes(32).toString("hex");
const hash = pbkdf2Sync(password, Buffer.from(salt, "hex"), 100_000, 32, "sha256").toString("hex");

console.log("Save this new admin password in a password manager; it is shown only once.");
console.log(`ADMIN_PASSWORD=${password}`);
console.log(`ADMIN_PASSWORD_HASH=100000:${salt}:${hash}`);
