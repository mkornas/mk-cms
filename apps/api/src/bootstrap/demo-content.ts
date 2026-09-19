/**
 * Demo content for a fresh install (`SEED_DEMO=true`): a small, obviously
 * fictional studio site as a WordPress WXR export, run through the importer
 * so the admin has pages, posts, categories and tags to show. Kept as a
 * string so it ships inside the build with no file copying.
 */

const item = (o: {
  id: number;
  title: string;
  slug: string;
  type: 'post' | 'page';
  date: string;
  excerpt?: string;
  content: string;
  categories?: string[];
  tags?: string[];
}): string => `
<item>
  <title>${o.title}</title>
  <content:encoded><![CDATA[${o.content.trim()}]]></content:encoded>
  <excerpt:encoded><![CDATA[${o.excerpt ?? ''}]]></excerpt:encoded>
  <wp:post_id>${o.id}</wp:post_id>
  <wp:post_name>${o.slug}</wp:post_name>
  <wp:status>publish</wp:status>
  <wp:post_type>${o.type}</wp:post_type>
  <wp:post_date_gmt>${o.date} 09:00:00</wp:post_date_gmt>
  ${(o.categories ?? []).map((c) => `<category domain="category" nicename="${c.toLowerCase()}"><![CDATA[${c}]]></category>`).join('\n  ')}
  ${(o.tags ?? []).map((t) => `<category domain="post_tag" nicename="${t.toLowerCase().replace(/\s+/g, '-')}"><![CDATA[${t}]]></category>`).join('\n  ')}
</item>`;

const items = [
  item({
    id: 1, title: 'Home', slug: 'home', type: 'page', date: '2026-01-06',
    content: `<h2>A small studio for calm websites</h2>
<p>Northwind Studio designs and builds websites for people who would rather talk to their customers than to their CMS. Static where it can be, dynamic where it must be, fast everywhere.</p>
<p><a href="/services">See what we do</a> or <a href="/contact">say hello</a>.</p>`,
  }),
  item({
    id: 2, title: 'About', slug: 'about', type: 'page', date: '2026-01-06',
    content: `<p>We are two people, a designer and an engineer, working from a shared studio by the harbour. Since 2019 we have shipped forty-odd sites for cafés, clinics, workshops and one lighthouse.</p>
<p>We keep clients' content in one place and their sites on the edge. That is the whole method.</p>`,
  }),
  item({
    id: 3, title: 'Services', slug: 'services', type: 'page', date: '2026-01-06',
    content: `<ul>
<li><strong>Websites</strong> — design, build, launch; content editable by you.</li>
<li><strong>Care</strong> — updates, backups, a person who answers.</li>
<li><strong>Accessibility audits</strong> — WCAG 2.2 AA, with the fixes, not just the report.</li>
</ul>`,
  }),
  item({
    id: 4, title: 'Contact', slug: 'contact', type: 'page', date: '2026-01-06',
    content: `<p>Write to <a href="mailto:hello@northwind.example">hello@northwind.example</a> or use the form below. We answer within two working days.</p>`,
  }),
  item({
    id: 10, title: 'Why we moved the studio site off WordPress', slug: 'off-wordpress', type: 'post', date: '2026-02-11',
    excerpt: 'Eleven plugins, three of them abandoned, one of them the reason for the outage.',
    content: `<p>Eleven plugins, three of them abandoned, one of them the reason for the outage. That was our own site, the one we point clients at.</p>
<p>The fix was not a better theme. It was separating the two jobs WordPress does at once: keeping content and serving pages. Content now lives in a headless CMS; the site is static HTML on a CDN, rebuilt when something is published.</p>
<p>Editors noticed nothing except that previews got faster. Visitors noticed the site loads before the click finishes.</p>`,
    categories: ['News'], tags: ['Studio', 'Performance'],
  }),
  item({
    id: 11, title: 'A publishing checklist for small teams', slug: 'publishing-checklist', type: 'post', date: '2026-03-03',
    excerpt: 'Seven questions before the green button.',
    content: `<ol>
<li>Does the title say what the page is about, in the first five words?</li>
<li>Is there one image, and does it have an alt text a blind reader would thank you for?</li>
<li>Is the excerpt a sentence you would say out loud?</li>
<li>Which category — one, not four?</li>
<li>Did you preview it on a phone?</li>
<li>Is there a link back to something older that still matters?</li>
<li>Who needs to know it went out?</li>
</ol>`,
    categories: ['Guides'], tags: ['Editorial'],
  }),
  item({
    id: 12, title: 'Scheduling posts for a quiet August', slug: 'quiet-august', type: 'post', date: '2026-04-15',
    excerpt: 'Write in June, publish while you are on a boat.',
    content: `<p>We write the summer posts in June and schedule them. The CMS publishes each one at nine on its morning, fires the webhook, and the site rebuilds itself. Nobody is at a desk.</p>
<p>The trick is the revision history: when a scheduled post needs a change from a phone, you edit, save, and the scheduled version updates without touching the date.</p>`,
    categories: ['Guides'], tags: ['Editorial', 'Workflow'],
  }),
  item({
    id: 13, title: 'The lighthouse', slug: 'the-lighthouse', type: 'post', date: '2026-05-20',
    excerpt: 'Our strangest client, and the one we learned most from.',
    content: `<p>The lighthouse is a museum now. Its website needed three things: opening hours that change with the tide table, a ticket form, and photographs that load on a ferry's connection.</p>
<p>We modelled "opening day" as a content type with a date field and a note, so the volunteers edit a list instead of a page. The form posts to the CMS and emails the harbour office. The photographs are served as WebP in four sizes, generated on upload.</p>`,
    categories: ['News'], tags: ['Case study'],
  }),
  item({
    id: 14, title: 'Accessibility is a launch requirement, not a phase', slug: 'a11y-launch', type: 'post', date: '2026-06-30',
    excerpt: 'What "AA" means for a café menu page, concretely.',
    content: `<p>For a café, WCAG 2.2 AA is mostly four things: contrast on the menu, focus you can see, a form you can complete with a keyboard, and an alt text on the photo of the cake.</p>
<p>We audit before launch and fix in the code, then keep a short checklist for editors — because the next photo of a cake will not have an alt text unless the form asks for one.</p>`,
    categories: ['Guides'], tags: ['Accessibility'],
  }),
  item({
    id: 15, title: 'Summer hours', slug: 'summer-hours', type: 'post', date: '2026-07-01',
    excerpt: 'The studio closes at three on Fridays until September.',
    content: `<p>The studio closes at three on Fridays until September. Care clients keep the same response times; everything else waits for Monday, which is usually fine.</p>`,
    categories: ['News'], tags: ['Studio'],
  }),
];

export const DEMO_WXR = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>Northwind Studio</title>
  <link>https://northwind.example</link>
  <description>A small studio for calm websites</description>
  <wp:wxr_version>1.2</wp:wxr_version>
  ${items.join('\n')}
</channel>
</rss>`;
