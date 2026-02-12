import type { Comment } from "@swarmboard/shared";
import { CreateCommentBody } from "@swarmboard/shared";
import { Elysia } from "elysia";
import { conflictResponse, etagRequiredResponse, notFoundResponse } from "../middleware/etag";
import { readBoard } from "../storage/board";
import { readComments, writeComments } from "../storage/comments";

export const commentRoutes = new Elysia({ prefix: "/stories" })
	.get("/:id/comments", async ({ params, store }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;

		// Verify story exists
		const boardResult = await readBoard(bucket);
		if (!boardResult) {
			return notFoundResponse("Board not initialized. Call POST /board/init first");
		}

		const story = boardResult.board.userStories.find((s) => s.id === params.id);
		if (!story) {
			return notFoundResponse(`Story ${params.id} not found`);
		}

		const result = await readComments(bucket, params.id);

		return new Response(JSON.stringify({ comments: result.comments, etag: result.etag }), {
			headers: {
				"content-type": "application/json",
				...(result.etag ? { etag: result.etag } : {}),
			},
		});
	})
	.post(
		"/:id/comments",
		async ({ params, body, headers, store }) => {
			const bucket = (store as { bucket: R2Bucket }).bucket;
			const agent = headers["x-agent"] ?? "unknown";

			// Verify story exists
			const boardResult = await readBoard(bucket);
			if (!boardResult) {
				return notFoundResponse("Board not initialized. Call POST /board/init first");
			}

			const story = boardResult.board.userStories.find((s) => s.id === params.id);
			if (!story) {
				return notFoundResponse(`Story ${params.id} not found`);
			}

			const clientEtag = headers["if-match"];
			const commentsResult = await readComments(bucket, params.id);

			// For first comment, accept * or null etag
			if (commentsResult.etag !== null && clientEtag !== "*") {
				if (!clientEtag) return etagRequiredResponse();
				if (clientEtag !== commentsResult.etag) {
					return conflictResponse("Comments were modified. Re-read and retry.");
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
				return conflictResponse("Comments were modified. Re-read and retry.");
			}

			return new Response(JSON.stringify({ ...comment, etag: writeResult.etag }), {
				status: 201,
				headers: {
					"content-type": "application/json",
					etag: writeResult.etag,
				},
			});
		},
		{ body: CreateCommentBody },
	);
