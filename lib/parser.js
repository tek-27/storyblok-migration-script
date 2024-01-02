const cheerio = require('cheerio');

const parser = (htmlString) => {

    const $ = cheerio.load(htmlString);

    $('.c-chart-media__fallback-img').css('display', 'none')
    $('img').each((index, element) => {
        const $element = $(element);
        const dataSrc = $element.attr('data-src');
        if (dataSrc) {
            $element.attr('src', `https://www.kingsfund.org.uk/${dataSrc}`);
        }
    });

    const modifiedHTMLString = $.html();

    return modifiedHTMLString
}

const getFlourishData = (htmlString) => {

    const $ = cheerio.load(htmlString);

    $('.c-chart-media__fallback-img').css('display', 'none')
    $('img').each((index, element) => {
        const $element = $(element);
        const dataSrc = $element.attr('data-src');
        if (dataSrc) {
            $element.attr('src', `https://www.kingsfund.org.uk/${dataSrc}`);
        }
    });

    const modifiedHTMLString = $.html();

    const result = {
        before: '',
        after: ''
    };

    // Find the element with the specified class
    const targetElement = $('.embedded-entity.c-media.c-media--chart');
    const flourishHtml = targetElement.html();
    // Check if the element exists
    if (targetElement.length) {
        // Iterate through previous siblings to get the content before the target element
        let prevElement = targetElement.prev();

        while (prevElement.length) {
            result.before = prevElement.toString() + result.before;
            prevElement = prevElement.prev();
        }

        // Iterate through next siblings to get the content after the target element
        let nextElement = targetElement.next();
        while (nextElement.length) {
            result.after += nextElement.toString();
            nextElement = nextElement.next();
        }
    }

    if (targetElement.length) {
        return {
            before:result.before, flourishHtml, after:result.after
        }
    }

    return { after:modifiedHTMLString }
}


const parseFootnoteAndMainBody = (htmlString) => {
    const $ = cheerio.load(htmlString);
    const footNotes = $('.footnotes').html();

    $('.footnotes').remove()

    const mainBody = $.html()

    return { mainBody, footNotes }
}

const getParsedFootNotes = (html) => {
    const $ = cheerio.load(html)
    const footnotesValues = []
    $('li.footnote').each((index, element) => {
        const label = $('li > a.footnote-label').text()
        $('li > a.footnote-label').remove()
        const footnoteValue = $(element).text().trim();
        footnotesValues.push({label, footnoteValue});
    })
    return footnotesValues
}

module.exports = {
    parser, parseFootnoteAndMainBody, getParsedFootNotes, getFlourishData
}