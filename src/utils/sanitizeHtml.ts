// SECURITY: see docs/plans/01-security-hardening.md §1.4.
// Activity notes/tasks may originate from Notion pages and AI parsing, both untrusted.
// Always run user-controlled HTML through this sanitizer before dangerouslySetInnerHTML.
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'a', 'b', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 's', 'strong', 'u', 'ul',
  'blockquote',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'];

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  });
}
