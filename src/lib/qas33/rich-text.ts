// QAS33 — Rich-text (HTML) sanitizer for news articles & broadcast content.
// Standalone module (no imports) so it can be reused by services AND scripts.
//
// Allows a small, government-content-friendly tag set:
//   p, br, b, strong, i, em, u, ul, ol, li, h2, h3, h4, blockquote
//   a (only with an http/https/mailto href — forced to target=_blank
//      rel="noopener noreferrer")
// Everything else (scripts, iframes, event handlers, style attributes, custom
// tags…) is removed or HTML-escaped so it renders as inert text.

const ALLOWED_TAGS = new Set([
  "p", "br", "b", "strong", "i", "em", "u",
  "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "a",
]);

const VOID_TAGS = new Set(["br"]);

const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript", "svg", "math"]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;

/** Extract a single attribute value from a raw attribute string. */
function readAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = attrs.match(re);
  if (!m) return null;
  return (m[2] ?? m[3] ?? m[4] ?? "").trim();
}

/**
 * Sanitize untrusted rich-text HTML. Disallowed tags are escaped (rendered as
 * literal text); dangerous containers (script/style/iframe…) are dropped with
 * their content. Links keep only http/https/mailto hrefs and are forced to
 * open safely in a new tab.
 */
export function sanitizeRichText(input: unknown, maxLen = 50000): string {
  if (typeof input !== "string") return "";
  let html = input.slice(0, maxLen);
  // Strip control characters
  html = html.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  // Drop dangerous containers together with their content
  for (const tag of DROP_WITH_CONTENT) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, "gi");
    html = html.replace(re, "");
    // unclosed container → drop the bare tag as well
    html = html.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "");
  }

  let out = "";
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(html)) !== null) {
    // text before the tag — escape it
    out += escapeHtml(html.slice(lastIndex, m.index));
    lastIndex = m.index + m[0].length;

    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    const attrs = m[3] ?? "";
    const selfClosing = m[4] === "/";

    if (!ALLOWED_TAGS.has(name)) {
      out += escapeHtml(m[0]); // inert literal text
      continue;
    }
    if (closing) {
      out += VOID_TAGS.has(name) ? "" : `</${name}>`;
      continue;
    }
    if (name === "a") {
      const href = readAttr(attrs, "href") ?? "";
      if (/^(https?:\/\/|mailto:)/i.test(href)) {
        out += `<a href="${escapeAttr(href)}" rel="noopener noreferrer" target="_blank">`;
      }
      // invalid/missing href → drop the anchor wrapper (text stays)
      continue;
    }
    out += VOID_TAGS.has(name) || selfClosing ? `<${name}>` : `<${name}>`;
  }
  out += escapeHtml(html.slice(lastIndex));
  return out.trim();
}

/** Strip HTML to plain text (tags removed, entities decoded, whitespace collapsed). */
export function htmlToPlainText(html: unknown, maxLen = 400): string {
  if (typeof html !== "string") return "";
  let s = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  // decode the common entities so excerpts read naturally
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  return s.replace(/\s+/g, " ").trim().slice(0, maxLen);
}
