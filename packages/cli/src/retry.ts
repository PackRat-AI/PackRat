export async function withRetry<T>(
	fn: () => Promise<{ status: number; data: T | null; error: string | null }>,
	maxRetries = 3,
): Promise<{ data: T | null; error: string | null; status: number }> {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		const result = await fn();

		if (result.status !== 409 || attempt >= maxRetries - 1) {
			return result;
		}

		const jitter = Math.random() * 100 - 50;
		await new Promise((r) => setTimeout(r, 100 * 2 ** attempt + jitter));
	}

	return { data: null, error: "Max retries exceeded", status: 409 };
}
