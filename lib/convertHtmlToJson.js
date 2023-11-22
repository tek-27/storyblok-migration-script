const TurndownService = require('turndown');
const pkg = require('storyblok-markdown-richtext');
const { markdownToRichtext } = pkg;

const turndownService = new TurndownService();

function convertHtmlToJson(html) {
  if (!html) return;

  if(html.includes('data-src')) {
    html = html.replace(/data-src="/, 'src="https://www.kingsfund.org.uk')
  }
  
  return markdownToRichtext(turndownService.turndown(html));
}

module.exports = {convertHtmlToJson};
