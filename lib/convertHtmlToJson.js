const TurndownService = require('turndown');
const pkg = require('storyblok-markdown-richtext');
const { markdownToRichtext } = pkg;

const turndownService = new TurndownService();
// turndownService.keep(['iframe'])

function convertHtmlToJson(html) {
  if (!html) return;

  if (html.includes('data-src')) {
    html = html.replace(/data-src="/, 'src="https://www.kingsfund.org.uk')
  }

  return markdownToRichtext(turndownService.turndown(html));
}

function breakIframe(html) {

  // Find the position of the opening <iframe> tag
  const iframeStartIndex = html.indexOf('\u003Ciframe');

  if (iframeStartIndex !== -1) {
    // Extract the portion before the <iframe> tag
    const beforeIframe = html.substring(0, iframeStartIndex);

    // Find the position of the closing </iframe> tag
    const iframeEndIndex = html.indexOf('</iframe>', iframeStartIndex) || html.indexOf('\u003C/iframe\u003E', iframeStartIndex);

    if (iframeEndIndex !== -1) {
      // Extract the <iframe> tag and its content
      const iframePortion = html.substring(iframeStartIndex, iframeEndIndex + '\u003C/iframe\u003E'.length);

      // Extract the portion after the </iframe> tag
      const afterIframe = html.substring(iframeEndIndex + '\u003C/iframe\u003E'.length);

      return { beforeIframe, iframePortion, afterIframe };

    } else {
      return false
    }
  } else {
    return false
  }


}
module.exports = { convertHtmlToJson, breakIframe };
