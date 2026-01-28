# Bug Investigation: AI Only Detects Template Pack Items with Images

## Issue
When using a template pack and asking the AI if anything is missing, it only recognizes items that have images attached. Items without images are ignored.

## Investigation Summary

After thorough code review, I could NOT find any explicit filtering by images in:
1. `getPackDetails` tool in `packages/api/src/utils/ai/tools.ts` - returns ALL items
2. `getPackDetails` DB utility in `packages/api/src/utils/DbUtils.ts` - no image filter
3. `computePackWeights` in `packages/api/src/utils/compute-pack.ts` - processes all items
4. Gap analysis prompt in `packages/api/src/routes/packs/pack.ts` - includes all items
5. Template item copying in `apps/expo/features/pack-templates/hooks/useCreatePackFromTemplate.ts` - copies all items

## Hypothesis

The Vercel AI SDK (v4.x) may be automatically converting tool results with image URLs into multimodal message parts, which could cause the AI model to focus primarily on visual content when items have images, potentially overlooking text-only items.

## Testing Plan

1. **Create a test template pack** with:
   - 3 items WITH images
   - 3 items WITHOUT images

2. **Create a pack from this template**

3. **Ask the AI** "What items are in my pack?" or "List all items in my pack"

4. **Verify** if the AI response includes ALL 6 items or only the 3 with images

5. **Check the network traffic** to see what data is actually being sent to/from the AI

## Potential Fixes

### Option 1: Ensure items are text-only in tool results
Modify the `getPackDetails` tool to explicitly exclude image URLs from item data sent to the AI, providing images only in the UI rendering.

### Option 2: Add explicit instruction in system prompt
Update the system prompt to explicitly state: "When analyzing pack contents, consider ALL items regardless of whether they have images or visual representations."

### Option 3: Format items more explicitly in tool output
Instead of returning raw item objects, format items as a clear text list that emphasizes all items equally.

## Files to Modify

If hypothesis is confirmed, the fix should be in:
- `packages/api/src/utils/ai/tools.ts` - `getPackDetails` tool
- `packages/api/src/routes/chat.ts` - system prompt
