type ChatContext = {
  itemId?: string
  itemName?: string
  packId?: string
  packName?: string
  contextType: "item" | "pack" | "general"
}

export function generatePromptWithContext(userMessage: string, context?: ChatContext): string {
  if (!context || context.contextType === "general") {
    return userMessage
  }

  if (context.contextType === "item" && context.itemName) {
    return `[About item: ${context.itemName}] ${userMessage}`
  }

  if (context.contextType === "pack") {
    return `[About my pack] ${userMessage}`
  }

  return userMessage
}

export function getContextualSuggestions(context?: ChatContext): string[] {
  if (!context || context.contextType === "general") {
    return [
      "What gear should I bring for a weekend hike?",
      "How can I reduce my pack weight?",
      "What's the best way to organize my pack?",
    ]
  }

  if (context.contextType === "item" && context.itemName) {
    return [
      `Tell me more about ${context.itemName}`,
      `What are alternatives to ${context.itemName}?`,
      `How can I reduce the weight of my ${context.itemName}?`,
      `Is ${context.itemName} worth bringing on a short trip?`,
    ]
  }

  if (context.contextType === "pack") {
    return [
      "Analyze my pack for weight savings",
      "What am I missing from my pack?",
      "How can I better organize these items?",
    ]
  }

  return []
}

export function getContextualGreeting(context?: ChatContext): string {
  if (!context || context.contextType === "general") {
    return "Hi there! I'm your PackRat AI assistant. How can I help you with your gear today?"
  }

  if (context.contextType === "item" && context.itemName) {
    return `I see you're looking at ${context.itemName}. What would you like to know about it?`
  }

  if (context.contextType === "pack" && context.packName) {
    return `I see you're working with your ${context.packName}. How can I help optimize your pack?`
  }

  return "Hi there! I'm your PackRat AI assistant. How can I help you with your gear today?"
}

