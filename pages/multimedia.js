const fs = require('fs');
const path = require('path');
const config = require('../config')
const { addToStoryblok } = require('../lib/addToStoryblok');
const { UploadFileToStoryblok } = require('../lib/assetUpload');
const { convertHtmlToJson, breakIframe } = require('../lib/convertHtmlToJson')
const { calculateReadingTime, createSlug } = require('../helpers/general')
const { delay } = require('../lib/delay');
const { getNewStoryIDFromOldID } = require('../lib/getStoryIdfromOldId');
const processedTopics = require('../data/processed/processed-topics.json')
const { processedTopics: mappingTopics } = require('../lib/topicsMap')
const { internalId: staffs } = require('../data/processed/processed-staff.json');
const multimediaFolderPath = '../data/raw/multimedia'
const { parser, parseFootnoteAndMainBody, getParsedFootNotes, getFlourishData } = require('../lib/parser')
const nodeAlias = require('../data/processed/processed-node-alias.json')

const contentTypes = {
    8104: { category: "Audio", folderId: 417726531 },
    8105: { category: "Videos", folderId: 417725986 },
    // 8106: { category: "Slideshow", folderId: 417726531 },
    8155: { old_category: "Data visualisation", category: "Data and charts", folderId: 417726570 },
    // 8194: { category: "Timeline", folderId: 417726531 },
    // 8193: { category: "Map", folderId: 417726531 },
}

async function process({ data: multimedia }) {

    const errors = []
    try {
        let i = 0;
        const reversedMultimedia = [...multimedia.reverse()]

        for (let multimedia of reversedMultimedia) {
            i++;
            if (i > 1) {
                break;
            }
            const multimediaData = multimedia
            const data = await getPopulatedData(multimediaData)

            if (!data) {
                continue;
            }

            const type = data?.story?.content?.category[0]

            if (!type) {
                console.log(`skipped for ${data.story.name}`)
                continue
            }


            if (type) {

                if (!config.component.multimedia.slug_directories[type]) {
                    console.log(`Skipping... config value not found for ${type}`)
                    continue
                }

                console.log(`${config.environment}/${config.component.multimedia.slug_directories[type]}/${data?.story?.slug}`)
                const existing = await getNewStoryIDFromOldID({ fullSlug: `${config.environment}/${config.component.multimedia.slug_directories[type]}/${data?.story?.slug}`, id: data?.story?.content?.id, getUUID: false })
                    .catch(error => {
                        if (error.status === 404) {
                            return undefined;
                        }
                        console.log("RRRRRRRR", error)
                        throw new Error(error.message, error?.status, error?.response)
                    })

                console.log("uploading ", data.story.name, "...")

                // Uploading the assets to StoryBlok for using it in story

                // console.log("uploading asset for ", data.story.name)
                // const id = await getNewStoryIDFromOldID({startsWith:'development/insight-and-analysis', id:98000891});
                // const featureImage = await UploadFileToStoryblok('https://reasondigital.com/wp-content/uploads/2020/11/glasses-on-blue-2-1.svg');

                // data.story.content.featured_image = {
                //     ...featureImage,
                //     "alt": ""
                // }

                const response = await addToStoryblok(data, existing);

                await delay(500)

                const jsonResponse = await response.json();

                if (response.status !== 200 && response.status !== 201) {
                    errors.push(jsonResponse)
                }

            }

        }

        if (errors.length === 0) {
            console.log("Upload Succeeded!!!")
        } else {
            console.log("Errors:", errors)
        }

    } catch (err) {

        console.log("Global error", err)

    }

}

const getPopulatedData = async (data) => {

    let {
        drupal_internal__nid,
        drupal_internal__vid,
        langcode,
        revision_timestamp,
        title,
        created,
        changed,
        body,
        field_comments,
        field_summary,
        field_author_name,
        field_subtitle,
        field_multimedia_meta,
        field_health_topics,
        field_author,
        field_download,
        field_download_summary,
        field_multimedia_type,
        field_slices: pageSlicesData,
        field_meta_tags,
        path
    } = data

    const slug = path.alias.split('/')
    const slugAlias = slug.reverse()[0]
    console.log(slugAlias)

    // 337912

    let document = [];

    if (field_health_topics && !Array.isArray(field_health_topics)) {
        if (field_health_topics.data.length > 0) {
            field_health_topics = field_health_topics.data
        } else {
            field_health_topics = []
        }
    }

    const {
        title: metaTitle,
        description: metaDescription,
        twitter_cards_type,
        og_image_url,
        og_title
    } = field_meta_tags || {}

    const SEO = {
        "title": `${title} | The King's Fund`,
        "og_image": "",
        "og_title": title,
        "description": metaDescription || field_summary,
        "twitter_image": "",
        "twitter_title": title,
        "og_description": field_summary,
        "twitter_description": field_summary
    }

    if (metaTitle) {
        SEO.title = metaTitle.replace(/\[node:title\]/g, title)
            .replace(/\[site:name\]/, "The King's Fund")
    }

    if (metaDescription) {
        SEO.description = metaDescription
    } else {
        SEO.description = field_summary
    }

    if (og_image_url) {
        SEO.og_image = og_image_url.replace(/\[site:url\]/g, 'https://www.kingsfund.org.uk')
        const imageExistenceCheck = await fetch(SEO.og_image)
        if (!imageExistenceCheck.status === 404) {
            const upload = await UploadFileToStoryblok(SEO.og_image)
            SEO.og_image = upload.filename
        }
    }

    if (og_title) {
        SEO.og_title = og_title.replace(/\[node:title\]/g, title)
    }

    const multimediaTypeId = field_multimedia_type?.meta?.drupal_internal__target_id
    const category = contentTypes[multimediaTypeId] ? contentTypes[multimediaTypeId].category : undefined

    if(!category) {
        console.log("No category specified for", title , "\n")
        return null
    }

    const topics = (field_health_topics?.data || []).map(({ id, meta }) => {
        const { drupal_internal__target_id: target_id } = meta
        const topicValue = processedTopics[target_id]?.title[0]?.value
        if (mappingTopics.hasOwnProperty(topicValue)) {
            return mappingTopics[topicValue]
        }
        return topicValue
    }).filter(topicValue => !!topicValue)


    let staffDetails, guestAuthor = [], postAuthor = []

    if (field_author?.length > 0) {

        for (const author of field_author) {

            const internalId = author.meta.drupal_internal__target_id

            staffDetails = staffs[internalId]
            const newAuthor = await getNewStoryIDFromOldID({ fullSlug: `${config.environment}/${config.component.staff.slug_directory}/${createSlug(staffDetails.title)}`, getAll: true })
                .catch(error => {
                    console.log("author fetch error", error)
                    return false;
                });

            if (newAuthor) {
                postAuthor.push({
                    "_uid": newAuthor?.story?.uuid,
                    "author": {
                        "id": newAuthor?.story?.uuid,
                        "url": "",
                        "linktype": "story",
                        "fieldtype": "multilink",
                        "cached_url": newAuthor?.story?.full_slug
                    },
                    "component": "author"
                })
            }

        }

    }

    if (field_author_name) {
        guestAuthor = field_author_name.map(author => {
            if (!author.value) {
                return
            }

            return {
                "name": author.value,
                "component": "guest_author",
            }
        }).filter(author => !!author)
    }

    let fieldAccordianId = [], fieldAccordianData
    let storyContents = [], storyAccordian = [], storySlices = []

    let bodyContent = {}

    if (body?.processed) {

        const { mainBody, footNotes } = parseFootnoteAndMainBody(body.processed)

        if (mainBody.includes('iframe')) {
            bodyContent = {
                "component": "iframe_embed",
                "iframe_embed": mainBody,
            }
        } else {
            bodyContent.component = "rich_text"
            bodyContent.text = convertHtmlToJson(mainBody)
        }

        if (footNotes) {
            const parsedFootNotes = getParsedFootNotes(footNotes)
            const formattedFootNotes =
                parsedFootNotes.map((footnote) => {
                    return {
                        "component": "footnote",
                        "link_reference": {
                            "id": "",
                            "url": "",
                            "linktype": "story",
                            "fieldtype": "multilink",
                            "cached_url": ""
                        },
                        "text_reference": footnote.footnoteValue,
                        "number_reference": footnote.label
                    }
                }
                )

            bodyContent.footnotes = formattedFootNotes
        }

    }

    if (pageSlicesData?.length > 0) {
        storySlices = pageSlicesData.flatMap(slice => {

            const { type, id, attributes, relationships, field_title, field_text_content, field_link, field_teaser_item } = slice

            if (type == 'slice--cta_banner') {

                if (!field_link?.title) {
                    return {
                        "component": "rich_text",
                        "text": convertHtmlToJson(field_text_content.processed ? `<h3>${field_title ? field_title : ''}</h3>` + field_text_content.processed : ''),
                    }
                }

                let ctaUrl = field_link?.uri
                if (!field_link.uri.match(/https?:\/\//)) {
                    const entity = field_link.uri.split(':')
                    const alias = `https://www.kingsfund.org.uk${nodeAlias[`/${entity[1]}`]}`
                    ctaUrl = alias
                }

                return {
                    "post": {
                        "url": ctaUrl,
                        "linktype": "url",
                        "fieldtype": "multilink",
                        "cached_url": ctaUrl
                    },
                    "image": {},
                    "title": field_title,
                    "description": field_text_content?.processed?.replace(/<[^>]*>/g, ''),
                    "alignment": "right",
                    "component": "cta_signpost",
                    "button_link": {
                        "url": ctaUrl,
                        "linktype": "url",
                        "fieldtype": "multilink",
                        "cached_url": ctaUrl
                    },
                    "button_text": "",
                }

                // return {
                //     "component": "cta_banner",
                //     "title": field_title,
                //     "description": field_text_content?.processed,
                //     "button": [
                //         {
                //             link: {
                //                 "url": field_link?.uri,
                //                 "target": "_blank",
                //                 "linktype": "url",
                //                 "fieldtype": "multilink",
                //             },
                //             label: field_link?.title,
                //             "component": "button"
                //         }
                //     ]
                // }

            } else if (['slice--accordion', 'paragraph--accordion_item'].includes(type)) {

                const { field_accordion_item } = slice
                const accordianItems = field_accordion_item.map(ai => {
                    const { field_content, field_heading } = ai
                    return {
                        component: 'accordion',
                        items: [
                            {
                                title: field_heading,
                                text: convertHtmlToJson(field_content?.processed)
                            }
                        ]
                    }
                })

                return accordianItems


            } else if (field_text_content) {

                if (field_text_content?.processed.includes('\u003Ciframe') || field_text_content?.processed.includes('\u003Ciframe')) {

                    if (field_text_content.processed.includes('data-src')) {
                        const content = parser(field_text_content.processed)
                        return {
                            "component": "iframe_embed",
                            "iframe_embed": content ? `<h2>${field_title ? field_title : ''}</h2>` + content : '',
                        }
                    }

                    return {
                        "component": "iframe_embed",
                        "iframe_embed": field_text_content.processed ? `<h3>${field_title ? field_title : ''}</h3>` + field_text_content.processed : '',
                    }
                }

                // if(multimediaTypeId == 8155) {

                // if (field_text_content.processed.includes('data-src')) {
                //     const content = parser(field_text_content.processed)
                //     return {
                //         "component": "flourish_visual",
                //         "embed": content ? `<h2>${field_title ? field_title : ''}</h2>` + content : '',
                //     }
                // }

                if (field_title?.toLowerCase() == 'transcript') {
                    return {
                        component: 'accordion',
                        items: [
                            {
                                title: field_title,
                                text: convertHtmlToJson(field_text_content?.processed),
                                component: "accordion_item"
                            }
                        ]
                    }
                }

                if (field_text_content.processed.indexOf("flourish-embed")) {
                    const contents = []
                    const { before, flourishHtml, after } = getFlourishData(field_text_content.processed)

                    if (before?.length > 10) {

                        const { mainBody, footNotes } = parseFootnoteAndMainBody(before)

                        const content = {
                            "component": "rich_text",
                            "text": convertHtmlToJson(mainBody),
                        }

                        if (field_title) {
                            content.text = convertHtmlToJson(`<h3>${field_title ? field_title : ''}</h3>` + mainBody)
                        }

                        if (footNotes) {
                            const parsedFootNotes = getParsedFootNotes(footNotes)
                            const formattedFootNotes =
                                parsedFootNotes.map((footnote, index) => {
                                    return {
                                        "component": "footnote",
                                        "link_reference": {
                                            "id": "",
                                            "url": "",
                                            "linktype": "story",
                                            "fieldtype": "multilink",
                                            "cached_url": ""
                                        },
                                        "text_reference": footnote,
                                        "number_reference": index + 1
                                    }
                                }
                                )
                            content.footnotes = formattedFootNotes
                        }

                        if (content.text?.content && content.text?.type) {
                            contents.push(content)
                        }

                    }

                    if (flourishHtml?.length > 10) {
                        const flourishData = {
                            "component": "flourish_visual",
                            "embed": ""
                        }

                        if (!before && !after) {
                            flourishData.embed = `<h2>${field_title ? field_title : ''}</h2>` + flourishHtml
                        } else {
                            flourishData.embed = flourishHtml
                        }

                        contents.push(flourishData)
                    }

                    if (after?.length > 10) {

                        const { mainBody, footNotes } = parseFootnoteAndMainBody(after)

                        const content = {
                            "component": "rich_text",
                            "text": convertHtmlToJson(mainBody),
                        }

                        if (field_title && !before) {
                            content.text = convertHtmlToJson(`<h3>${field_title ? field_title : ''}</h3>` + mainBody)
                        }

                        if (footNotes) {
                            const parsedFootNotes = getParsedFootNotes(footNotes)
                            const formattedFootNotes =
                                parsedFootNotes.map((footnote) => {
                                    return {
                                        "component": "footnote",
                                        "link_reference": {
                                            "id": "",
                                            "url": "",
                                            "linktype": "story",
                                            "fieldtype": "multilink",
                                            "cached_url": ""
                                        },
                                        "text_reference": footnote.footnoteValue,
                                        "number_reference": footnote.label
                                    }
                                }
                                )
                            content.footnotes = formattedFootNotes
                        }

                        if (content.text?.content && content.text?.type) {
                            contents.push(content)
                        }
                    }

                    return contents
                }

                const { mainBody, footNotes } = parseFootnoteAndMainBody(field_text_content.processed)

                if (mainBody.length > 9) {
                    const richText = convertHtmlToJson(field_text_content.processed ? `<h2>${field_title ? field_title : ''}</h2>` + field_text_content.processed : '')

                    if (!richText?.content) {
                        return
                    }

                    const content = {
                        "component": "rich_text",
                        "text": richText
                    }

                    if (footNotes) {
                        const parsedFootNotes = getParsedFootNotes(footNotes)
                        const formattedFootNotes =
                            parsedFootNotes.map((footnote, index) => {
                                return {
                                    "component": "footnote",
                                    "link_reference": {
                                        "id": "",
                                        "url": "",
                                        "linktype": "story",
                                        "fieldtype": "multilink",
                                        "cached_url": ""
                                    },
                                    "text_reference": footnote,
                                    "number_reference": index + 1
                                }
                            }
                            )
                        content.footnotes = formattedFootNotes
                    }

                    return content
                }

            }

        }).filter(content => !!content)
    }

    const preparedData = {
        publish: '1',
        "story": {
            "name": title || "",
            "content": {
                "topic": topics,
                "migration_id": drupal_internal__nid,
                "content": [
                    bodyContent, ...storySlices
                ],
                seo: [
                    {
                        "fields": {
                            ...SEO,
                            "plugin": "seo_metatags",
                        },
                        "noindex": false,
                        "nofollow": false,
                        "component": "seo",
                    }
                ],
                "summary": field_summary,
                "component": "insight-and-analysis",
                "commissioned": false,
                "review_date": typeof changed === "string" ? changed.split('T')[0] : new Date(changed).toISOString().split('T')[0],
                "created_date": typeof created === "string" ? created.split('T')[0] : new Date(created).toISOString().split('T')[0],
                "time_to_read": field_multimedia_meta,
                "featured_image": null,
                "introduction_text": field_subtitle,
                "introduction_style": "standard"
            },
            "slug": slugAlias,
            "is_startpage": false,
            "parent_id": contentTypes[multimediaTypeId].folderId, // id of a folder
            "meta_data": {
                "title": title,
            }
        }
    }

    if (multimediaTypeId) {
        preparedData.story.content.category = [
            category
        ]
    }

    if (postAuthor) {
        preparedData.story.content.authors = [...postAuthor]
    }

    if (guestAuthor.length > 0) {
        if (preparedData.story.content.authors) {
            preparedData.story.content.authors = [...preparedData.story.content.authors, ...guestAuthor]
        }
        preparedData.story.content.authors = [...guestAuthor]
    }

    if (document.length > 0) {
        preparedData.story.content.content = [...document, ...preparedData.story.content.content]
    }

    if (topics.length > 0) {
        preparedData.story.tag_list = [topics[0]]
    }

    return preparedData

}

async function main() {
    const files = await fs.readdirSync(path.join(__dirname, multimediaFolderPath))
    for (const file of files) {
        const data = await fs.readFileSync(path.join(__dirname, multimediaFolderPath, file), 'utf8')
        await process(JSON.parse(data))
    }
}

main()

module.exports = main