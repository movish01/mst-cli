export function htmlToText(html: string): string {
  return html
    // Convert <br> and <br/> to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert </p> and </div> to newlines
    .replace(/<\/(p|div)>/gi, '\n')
    // Remove <img> tags, show placeholder
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '[$1]')
    .replace(/<img[^>]*>/gi, '[image]')
    // Remove <attachment> tags
    .replace(/<attachment[^>]*>.*?<\/attachment>/gi, '[attachment]')
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
