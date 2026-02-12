export function requireEtag(headers: Record<string, string | undefined>): string | null {
	const ifMatch = headers["if-match"];
	if (!ifMatch) return null;
	return ifMatch;
}

export function conflictResponse(message = "Board was modified by another agent. Re-read and retry.") {
	return new Response(
		JSON.stringify({
			error: "conflict",
			message,
			retry: true,
		}),
		{ status: 409, headers: { "content-type": "application/json" } },
	);
}

export function notFoundResponse(message: string) {
	return new Response(
		JSON.stringify({
			error: "not_found",
			message,
		}),
		{ status: 404, headers: { "content-type": "application/json" } },
	);
}

export function etagRequiredResponse() {
	return new Response(
		JSON.stringify({
			error: "precondition_required",
			message: "If-Match header required for this operation",
		}),
		{ status: 428, headers: { "content-type": "application/json" } },
	);
}

export function forbiddenResponse(message: string) {
	return new Response(
		JSON.stringify({
			error: "forbidden",
			message,
		}),
		{ status: 403, headers: { "content-type": "application/json" } },
	);
}
