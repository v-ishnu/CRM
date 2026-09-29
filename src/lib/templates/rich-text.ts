/**
 * Rich Text & HTML Sanitizer and Converter for Universal Message Templates & Chat
 * Supports Telegram HTML format, Web Push plain text, and CRM/Chat rich text.
 */

/**
 * Escape raw text so dynamic variables do not break Telegram HTML or browser HTML.
 */
export function escapeHtml(text: any): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strip all HTML tags to produce safe plain text (for push notifications, logs, etc.)
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Sanitize HTML strictly to the subset supported by Telegram Bot API.
 * Telegram supports:
 * <b>, <strong>, <i>, <em>, <u>, <ins>, <s>, <strike>, <del>, <span>, <tg-spoiler>,
 * <a href="...">, <code>, <pre>, <blockquote>
 *
 * Strips: <script>, <iframe>, <style>, <form>, <input>, onclick, javascript: links, etc.
 */
export function sanitizeTelegramHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  let sanitized = rawHtml;

  // 1. Remove dangerous script, iframe, object, embed tags and their contents
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // 2. Remove all on* event handlers (e.g. onclick, onerror)
  sanitized = sanitized.replace(/\s+on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/\s+on\w+='[^']*'/gi, '');
  sanitized = sanitized.replace(/\s+on\w+=\S+/gi, '');

  // 3. Normalize common HTML formatting
  sanitized = sanitized.replace(/<br\s*\/?>/gi, '\n');
  sanitized = sanitized.replace(/<p\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/p>/gi, '\n\n');
  sanitized = sanitized.replace(/<div\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/div>/gi, '\n');

  // 4. Sanitize <a> tags (ensure only http/https/tg links and remove all other attributes)
  sanitized = sanitized.replace(/<a\b([^>]*)>(.*?)<\/a>/gi, (_, attrs, content) => {
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return content;
    const href = hrefMatch[1].trim();
    if (!/^(https?:\/\/|tg:\/\/|mailto:)/i.test(href)) {
      return content;
    }
    return `<a href="${href}">${content}</a>`;
  });

  // 5. Allowed tags list for Telegram
  const allowedTags = [
    'b', 'strong',
    'i', 'em',
    'u', 'ins',
    's', 'strike', 'del',
    'code', 'pre',
    'blockquote',
    'a',
    'span',
    'tg-spoiler',
  ];

  // Regex to remove tags not in allowed list
  sanitized = sanitized.replace(/<\/?([a-z0-9-]+)(?:\s+[^>]*)?>/gi, (match, tagName) => {
    const lower = tagName.toLowerCase();
    if (allowedTags.includes(lower)) {
      if (lower === 'a') return match; // Already cleaned above
      if (match.startsWith('</')) return `</${lower}>`;
      return `<${lower}>`;
    }
    return '';
  });

  // 6. Ensure tag balance to prevent Telegram parsing errors
  sanitized = balanceTelegramTags(sanitized);

  return sanitized.trim();
}

/**
 * Ensure Telegram HTML tags are properly balanced so Telegram doesn't reject with 400 Bad Request.
 */
function balanceTelegramTags(html: string): string {
  const selfClosing = new Set(['br', 'hr', 'img']);
  const tags: string[] = [];
  const tagRegex = /<\/?([a-z0-9-]+)(?:\s+[^>]*)?>/gi;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    if (selfClosing.has(tagName)) continue;

    if (fullTag.startsWith('</')) {
      const lastIndex = tags.lastIndexOf(tagName);
      if (lastIndex !== -1) {
        tags.splice(lastIndex, 1);
      }
    } else {
      tags.push(tagName);
    }
  }

  // Close any unclosed tags at the end
  let balanced = html;
  while (tags.length > 0) {
    const unclosed = tags.pop();
    balanced += `</${unclosed}>`;
  }

  return balanced;
}

/**
 * Sanitize rich text for display in the CRM / Chat UI.
 * Allows safe formatting tags, blocks dangerous scripts, iframes, and javascript: links.
 */
export function sanitizeChatHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  let sanitized = rawHtml;

  // Remove scripts, styles, iframes
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/\s+on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/\s+on\w+='[^']*'/gi, '');
  sanitized = sanitized.replace(/\s+on\w+=\S+/gi, '');

  // Sanitize links
  sanitized = sanitized.replace(/<a\b([^>]*)>(.*?)<\/a>/gi, (_, attrs, content) => {
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return content;
    const href = hrefMatch[1].trim();
    if (!/^(https?:\/\/|mailto:)/i.test(href)) {
      return content;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-[#ff3e00] underline hover:text-white">${content}</a>`;
  });

  // Only allow standard formatting tags
  const allowedTags = [
    'b', 'strong',
    'i', 'em',
    'u', 'ins',
    's', 'strike', 'del',
    'code', 'pre',
    'blockquote',
    'a',
    'p', 'br',
    'ul', 'ol', 'li',
    'span',
  ];

  sanitized = sanitized.replace(/<\/?([a-z0-9-]+)(?:\s+[^>]*)?>/gi, (match, tagName) => {
    const lower = tagName.toLowerCase();
    if (allowedTags.includes(lower)) {
      if (lower === 'a') return match; // Already safe
      if (match.startsWith('</')) return `</${lower}>`;
      if (lower === 'code') return `<code class="px-1 py-0.5 bg-[#242428] text-[#ff3e00] font-mono text-xs rounded-xs">`;
      if (lower === 'pre') return `<pre class="p-2 bg-[#101012] border border-[#242428] font-mono text-xs overflow-x-auto my-1">`;
      if (lower === 'blockquote') return `<blockquote class="border-l-2 border-[#ff3e00] pl-2 text-[#a1a1aa] italic my-1">`;
      return `<${lower}>`;
    }
    return '';
  });

  return sanitized.trim();
}

/**
 * Convert markdown formatting (*bold*, _italic_, ~strike~, `code`, ```pre```) to Telegram HTML.
 */
export function convertMarkdownToTelegramHtml(markdown: string): string {
  if (!markdown) return '';

  let converted = markdown;

  // Code blocks: ```language\ncode``` or ```code```
  converted = converted.replace(/```(?:[a-z0-9_-]+)?\n?([\s\S]*?)```/gi, (_, code) => {
    return `<pre>${escapeHtml(code.trim())}</pre>`;
  });

  // Inline code: `code`
  converted = converted.replace(/`([^`\n]+)`/g, (_, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // Bold: **bold** or __bold__
  converted = converted.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  converted = converted.replace(/__([^_\n]+)__/g, '<b>$1</b>');

  // Italic: *italic* or _italic_
  converted = converted.replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, '$1<i>$2</i>$3');
  converted = converted.replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, '$1<i>$2</i>$3');

  // Strikethrough: ~strike~ or ~~strike~~
  converted = converted.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
  converted = converted.replace(/(^|[^\w~])~([^~\n]+)~([^\w~]|$)/g, '$1<s>$2</s>$3');

  // Links: [text](url)
  converted = converted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  return sanitizeTelegramHtml(converted);
}
