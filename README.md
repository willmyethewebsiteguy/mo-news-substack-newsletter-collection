# MO News Substack Newsletter Collection

This Squarespace 7.1 plugin loads the Mo News Substack archive into a searchable, paginated collection.

## Product frame

- User: a Mo News reader who wants to find a past newsletter.
- Problem: the Substack archive is outside the main Squarespace site and is hard to browse from the site.
- Smallest useful behavior: load recent newsletters, search them, and show a small page of linked cards.
- Mount: `[data-wm-plugin="mo-news-substack-newsletter-collection"]`.
- Content: the public Mo News collection proxy.

## API findings

The public collection endpoint is:

`https://mo-news-widgets-cdn-production.willmyers.workers.dev/collections/j579rrkbj4wte5aazer765x9x983mtk3.json?limit=100`

The endpoint returns full records with title, summary, canonical URL, publication date, plain text, and Markdown. The current Mo News records store their image in `sourceData.enclosureUrl`, while `thumbnailUrl` is empty. The plugin supports both fields. The endpoint accepts `limit`. It ignores `offset` and does not return a total count or next cursor. The plugin therefore downloads a bounded recent archive and paginates it in the browser.

## Install

Load the version-pinned CSS and JavaScript:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/willmyethewebsiteguy/mo-news-substack-newsletter-collection@1/mo-news-substack-newsletter-collection.css">
<script src="https://cdn.jsdelivr.net/gh/willmyethewebsiteguy/mo-news-substack-newsletter-collection@1/mo-news-substack-newsletter-collection.js"></script>
```

Then add this Code Block:

```html
<div data-wm-plugin="mo-news-substack-newsletter-collection"></div>
```

## Settings

The default settings load 100 newsletters and show 9 per page.

```html
<div
  data-wm-plugin="mo-news-substack-newsletter-collection"
  data-fetch-limit="100"
  data-page-size="9"
  data-heading="Newsletter archive"
  data-kicker="From the Mo News desk"
  data-search-placeholder="Search newsletters"
></div>
```

Site-wide JavaScript settings are also supported:

```js
window.MONewsSubstackNewsletterCollectionSettings = {
  fetchLimit: 100,
  pageSize: 9,
  openInNewTab: true
};
```

## Current non-goals

- The plugin does not render full newsletter bodies.
- The public proxy does not support server-side search or true server pagination.
