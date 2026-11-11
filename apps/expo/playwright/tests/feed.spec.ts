import { testIds } from '../../lib/testIds';
import { API_URL, BASE_URL, expect, test } from './fixtures';

async function seedFeedPost(
  page: import('@playwright/test').Page,
  caption: string,
): Promise<{ id: number; caption: string }> {
  const response = await page.request.post(`${API_URL}/api/feed`, {
    data: {
      caption,
      images: [`e2e-${Date.now()}.png`],
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { id: number };
  return { id: body.id, caption };
}

test.describe('Feed CRUD', () => {
  test('creates and deletes a post from the feed list', async ({ signedInPage: page }) => {
    test.setTimeout(90_000);
    const caption = `E2E-Feed-${Date.now()}`;
    const created = await seedFeedPost(page, caption);

    await page.goto(`${BASE_URL}/feed`);
    await expect(page.getByText(caption).first()).toBeVisible({ timeout: 15_000 });

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByTestId(testIds.feed.postDeleteBtn(created.id)).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(caption).first()).not.toBeVisible({ timeout: 15_000 });
  });

  test('opens a post, likes it, adds a comment, and deletes the comment', async ({
    signedInPage: page,
  }) => {
    test.setTimeout(120_000);
    const caption = `E2E-FeedDetail-${Date.now()}`;
    const commentText = `E2E-Comment-${Date.now()}`;
    const created = await seedFeedPost(page, caption);

    await page.goto(`${BASE_URL}/feed/${created.id}`);
    await expect(page.getByText(caption).first()).toBeVisible({ timeout: 15_000 });

    const likeResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/feed/${created.id}/like`) &&
        response.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByTestId(testIds.feed.postLikeBtn(created.id)).click();
    const likeResponse = await likeResponsePromise;
    expect(likeResponse.ok()).toBeTruthy();
    await expect(page.getByText('1').first()).toBeVisible({ timeout: 10_000 });

    const commentResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/feed/${created.id}/comments`) &&
        response.request().method() === 'POST' &&
        response.status() === 201,
      { timeout: 20_000 },
    );
    await page.getByTestId(testIds.feed.commentInput).fill(commentText);
    await page.getByTestId(testIds.feed.commentSubmitBtn).click();
    const commentResponse = await commentResponsePromise;
    const commentBody = (await commentResponse.json()) as { id: number };
    await expect(page.getByText(commentText).first()).toBeVisible({ timeout: 10_000 });

    const deleteCommentResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/feed/${created.id}/comments/${commentBody.id}`) &&
        response.request().method() === 'DELETE',
      { timeout: 20_000 },
    );
    await page.getByTestId(testIds.feed.commentDeleteBtn(commentBody.id)).click();
    await deleteCommentResponsePromise;
    await expect(page.getByText(commentText).first()).not.toBeVisible({ timeout: 10_000 });
  });
});
