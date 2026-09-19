/** Lowercase, ASCII-ish, hyphen-separated slug — matches the CMS SLUG_RE
 *  (letters, digits, hyphens; must start with a letter/digit). */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
