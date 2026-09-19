import { WxrParser } from './wxr-parser';

const wrap = (items: string) => `<?xml version="1.0"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/">
<channel><title>My Blog</title>${items}</channel></rss>`;

const ITEM = `<item>
  <title>Hello</title>
  <content:encoded><![CDATA[<p>Hi &amp; bye</p>]]></content:encoded>
  <excerpt:encoded><![CDATA[intro]]></excerpt:encoded>
  <wp:post_id>10</wp:post_id>
  <wp:post_name>hello</wp:post_name>
  <wp:status>publish</wp:status>
  <wp:post_type>post</wp:post_type>
  <wp:post_date_gmt>2021-05-04 07:30:00</wp:post_date_gmt>
  <category domain="category" nicename="news"><![CDATA[News]]></category>
  <category domain="post_tag" nicename="intro"><![CDATA[Intro]]></category>
</item>`;

describe('WxrParser', () => {
  const parser = new WxrParser();

  it('parses channel + a single item (CDATA content, terms, gmt date)', () => {
    const data = parser.parse(wrap(ITEM));
    expect(data.siteTitle).toBe('My Blog');
    expect(data.items).toHaveLength(1);
    const item = data.items[0];
    expect(item.title).toBe('Hello');
    expect(item.slug).toBe('hello');
    expect(item.status).toBe('publish');
    expect(item.type).toBe('post');
    // CDATA content is preserved literally — &amp; stays as HTML source.
    expect(item.content).toBe('<p>Hi &amp; bye</p>');
    expect(item.excerpt).toBe('intro');
    expect(item.postDate).toBe('2021-05-04 07:30:00');
    expect(item.terms).toEqual([
      { domain: 'category', slug: 'news', name: 'News' },
      { domain: 'post_tag', slug: 'intro', name: 'Intro' },
    ]);
  });

  it('normalizes multiple items into an array', () => {
    const data = parser.parse(wrap(ITEM + ITEM));
    expect(data.items).toHaveLength(2);
  });

  it('handles a channel with no items', () => {
    const data = parser.parse(wrap(''));
    expect(data.items).toEqual([]);
  });

  it('defaults status/type and lower-cases the slug', () => {
    const data = parser.parse(
      wrap(`<item><title>T</title><wp:post_name>My-Slug</wp:post_name></item>`),
    );
    expect(data.items[0]).toMatchObject({
      status: 'draft',
      type: 'post',
      slug: 'my-slug',
    });
  });

  it('parses an attachment url (falling back to guid)', () => {
    const withUrl = parser.parse(
      wrap(
        `<item><title>a.png</title><wp:post_type>attachment</wp:post_type>` +
          `<wp:attachment_url>http://old.test/a.png</wp:attachment_url></item>`,
      ),
    );
    expect(withUrl.items[0].attachmentUrl).toBe('http://old.test/a.png');

    const guidFallback = parser.parse(
      wrap(
        `<item><title>b.png</title><wp:post_type>attachment</wp:post_type>` +
          `<guid>http://old.test/b.png</guid></item>`,
      ),
    );
    expect(guidFallback.items[0].attachmentUrl).toBe('http://old.test/b.png');
  });

  it('throws on non-WXR input', () => {
    expect(() => parser.parse('<html></html>')).toThrow(/valid WXR/);
  });
});
