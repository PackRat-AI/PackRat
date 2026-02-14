import type { Comment } from "@swarmboard/shared";
import { CreateCommentBody } from "@swarmboard/shared";
import { Elysia } from "elysia";
import { readBoard } from "../storage/board";
import { readComments, writeComments } from "../storage/comments";

export const commentRoutes = new Elysia({ prefix: "/stories" })
	.get("/:id/comments", async ({ params, store, set, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;

		const boardResult = await readBoard(bucket);
		if (!boardResult) {
			return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
		}

		const story = boardResult.board.userStories.find((s) => s.id === params.id);
		if (!story) {
			return status(404, { error: "not_found", message: `Story ${params.id} not found` });
		}

		const result = await readComments({ bucket, storyId: params.id });

		if (result.etag) {
			set.headers.etag = result.etag;
		}
		return { comments: result.comments, etag: result.etag };
	})
	.post(
		"/:id/comments",
		async ({ params, body, headers, store, set, status }) => {
			const bucket = (store as { bucket: R2Bucket }).bucket;
			const agent = headers["x-agent"] ?? "unknown";

			const boardResult = await readBoard(bucket);
			if (!boardResult) {
				return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
			}

			const story = boardResult.board.userStories.find((s) => s.id === params.id);
			if (!story) {
				return status(404, { error: "not_found", message: `Story ${params.id} not found` });
			}

			const clientEtag = headers["if-match"];
			const commentsResult = await readComments({ bucket, storyId: params.id });

			if (commentsResult.etag !== null && clientEtag !== "*") {
				if (!clientEtag) {
					return status(428, { error: "precondition_required", message: "If-Match header required for this operation" });
				}
				if (clientEtag !== commentsResult.etag) {
					return status(409, { error: "conflict", message: "Comments were modified. Re-read and retry." });
				}
			}

			const now = new Date().toISOString();
			const comment: Comment = {
				id: crypto.randomUUID(),
				agent,
				body: body.body,
				at: now,
			};

			const updatedComments = [...commentsResult.comments, comment];
			const writeResult = await writeComments({
				bucket,
				storyId: params.id,
				comments: updatedComments,
				expectedEtag: commentsResult.etag,
			});

			if (!writeResult.ok) {
				return status(409, { error: "conflict", message: "Comments were modified. Re-read and retry." });
			}

			set.status = 201;
			set.headers.etag = writeResult.etag;
			return { ...comment, etag: writeResult.etag };
		},
		{ body: CreateCommentBody },
	);
