/**
 * Formats AI responses to improve readability in the chat UI
 * - Converts markdown lists to plain text with proper spacing
 * - Adds line breaks for better readability
 * - Handles emphasis and other formatting
 */
export function formatAIResponse(text: string): string {
    // Convert markdown lists to plain text with emoji bullets
    let formatted = text.replace(/^\s*[-*]\s+(.+)$/gm, "• $1")
  
    // Add proper spacing after periods, question marks, and exclamation points
    formatted = formatted.replace(/([.?!])\s*(?=[A-Z])/g, "$1\n\n")
  
    // Convert markdown emphasis to plain text
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, "$1")
    formatted = formatted.replace(/\*(.+?)\*/g, "$1")
  
    // Handle markdown headers
    formatted = formatted.replace(/^#+\s+(.+)$/gm, "$1")
  
    return formatted.trim()
  }
  
  