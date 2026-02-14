import { Elysia, t } from "elysia";
import { readUsers, writeUsers } from "../storage/users";
import { CreateUserBody, type User } from "@swarmboard/shared";

export const userRoutes = new Elysia({ prefix: "/users" })
	.get("/", async ({ store, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readUsers(bucket);
		
		if (!result) {
			return status(404, { error: "not_found", message: "No users found" });
		}

		// Return users without the sensitive apiKey field
		const safeUsers = result.users.map(({ apiKey, ...user }) => user);
		return { users: safeUsers, etag: result.etag };
	})
	.post(
		"/",
		async ({ body, store, status, set }) => {
			const bucket = (store as { bucket: R2Bucket }).bucket;
			
			// Validate request body
			const validated = CreateUserBody.safeParse(body);
			if (!validated.success) {
				return status(400, { error: "validation_error", details: validated.error });
			}

			const input = validated.data;
			
			// Read existing users
			const result = await readUsers(bucket);
			const existingUsers = result?.users ?? [];
			
			// Check for duplicate username
			if (existingUsers.some(u => u.username === input.username)) {
				return status(409, { error: "conflict", message: "Username already exists" });
			}

			// Generate new user
			const newUser: User = {
				id: crypto.randomUUID(),
				username: input.username,
				email: input.email,
				apiKey: crypto.randomUUID(),
				role: input.role,
				created_at: new Date().toISOString(),
			};

			// Save
			const writeResult = await writeUsers({
				bucket,
				users: [...existingUsers, newUser],
				expectedEtag: result?.etag,
			});

			if (!writeResult.ok) {
				return status(409, { error: "conflict", message: "Concurrent modification, please retry" });
			}

			// Return without apiKey (only shown once)
			const { apiKey, ...safeUser } = newUser;
			set.status = 201;
			return safeUser;
		},
		{ body: CreateUserBody },
	)
	.get("/:id", async ({ params, store, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readUsers(bucket);
		
		if (!result) {
			return status(404, { error: "not_found", message: "No users found" });
		}

		const user = result.users.find(u => u.id === params.id);
		if (!user) {
			return status(404, { error: "not_found", message: "User not found" });
		}

		// Return without apiKey
		const { apiKey, ...safeUser } = user;
		return safeUser;
	})
	.delete("/:id", async ({ params, store, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readUsers(bucket);
		
		if (!result) {
			return status(404, { error: "not_found", message: "No users found" });
		}

		const userIndex = result.users.findIndex(u => u.id === params.id);
		if (userIndex === -1) {
			return status(404, { error: "not_found", message: "User not found" });
		}

		// Remove user
		const updatedUsers = result.users.filter(u => u.id !== params.id);
		
		const writeResult = await writeUsers({
			bucket,
			users: updatedUsers,
			expectedEtag: result.etag,
		});

		if (!writeResult.ok) {
			return status(409, { error: "conflict", message: "Concurrent modification, please retry" });
		}

		return { success: true };
	});
