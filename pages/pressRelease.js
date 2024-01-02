const fs = require('fs');
const path = require('path');
const { addToStoryblok } = require('../lib/addToStoryblok');
const { UploadFileToStoryblok } = require('../lib/assetUpload');
const { convertHtmlToJson } = require('../lib/convertHtmlToJson')
const { calculateReadingTime, createSlug } = require('../helpers/general')
const { delay } = require('../lib/delay');
const { getNewStoryIDFromOldID } = require('../lib/getStoryIdfromOldId');
const processedTopics = require('../data/processed/processed-topics.json')
const { internalId: staffs } = require('../data/processed/processed-staff.json')
const {processedTopics:mappingTopics} = require('../lib/topicsMap')
const pressFolderPath = '../data/raw/press-releases'
const { parser, parseFootnoteAndMainBody, getParsedFootNotes, getFlourishData } = require('../lib/parser')
const config = require('../config')

let i = 0;

async function process({ data: press, included }) {

    const errors = []
    try {
        const reversedPress = [...press.reverse()]
        for (let press of reversedPress) {
            i++;
            // if (i > 1) {
            //     // process.exit(0);
            //     break;
            // }
            const pressData = press

            // if (!(i > 24 && i < 30)) {
            //     continue
            // }

            const data = await getPopulatedData(pressData, included)

            console.log(i)

            if (!data) {
                continue;
            }

            // const existing = await getNewStoryIDFromOldID({ fullSlug: `${config.environment}/${config.component["press-release"].slug_directory}/${data?.story?.slug}`, id: data?.story?.content?.id, getUUID: false })
            //     .catch(error => {
            //         console.log(`${config.environment}/${config.component["press-release"].slug_directory}/${data?.story?.slug}`)
            //         if (error.status === 404) {
            //             return undefined;
            //         }
            //         console.log("RRRRRRRR", error)
            //         throw new CustomError(error.message, error?.status, error?.response)
            //     })

            const existing = await getStoryWithMigrationID({ folder: 'insight-and-analysis', id: data?.story?.content?.migration_id, getUUID: false })
            .catch(error => {
                if (error.status === 404) {
                    return undefined;
                }
                console.log("RRRRRRRR", error)
                throw new CustomError(error.message, error?.status, error?.response)
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

        if (errors.length === 0) {
            console.log("Upload Succeeded!!!")
        } else {
            console.log("Errors:", errors)
        }

    } catch (err) {

        console.log("Global error", err)

    }

}

const getPopulatedData = async ({ attributes, relationships }, included) => {

    const {
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
        field_reading_time,
        field_meta_tags,
        path
    } = attributes

    const slug = path?.alias.split('/')
    const slugAlias = slug.reverse()[0]
    console.log(slugAlias)


    // if (!pressRelatedData[drupal_internal__nid]) {
    //     console.log("drupal_internal__nid", drupal_internal__nid)
    //     return
    // }

    const { field_health_topics, field_author, field_social_sharing_image } = relationships


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
            SEO.twitter_image = upload.filename
        }
    } else if (field_social_sharing_image.data) {

    }

    if (!og_image_url || !field_social_sharing_image) {
        const defaultImage = await UploadFileToStoryblok('https://www.kingsfund.org.uk/sites/default/files/2017-08/TKF-twitter-card.png')
        SEO.twitter_image = defaultImage.filename
        SEO.og_image = defaultImage.filename
    }

    if (og_title) {
        SEO.og_title = og_title.replace(/\[node:title\]/g, title)
    }

    const topics = (field_health_topics?.data || []).map(({ id, meta }) => {
        const { drupal_internal__target_id: target_id } = meta
        const topicValue = processedTopics[target_id]?.title[0]?.value
        if(!topicValue) {
            return undefined
        }
        if (mappingTopics.hasOwnProperty(topicValue.toLowerCase())) {
            return mappingTopics[topicValue.toLowerCase()]
        }
        return topicValue
    }).filter(topicValue => !!topicValue)

    let staffDetails, guestAuthor = [], postAuthor = []

    if (field_author?.data?.length > 0) {

        for (const author of field_author.data) {

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

    const { field_slices: pageSlices } = relationships
    let pageSlicesIds = pageSlices?.data.map(ps => ps.id)
    const pageSlicesData = included.filter(postIncludes => pageSlicesIds.includes(postIncludes.id))

    let storySlices = []
    if (pageSlicesData.length > 0) {
        storySlices = pageSlicesData.flatMap(slice => {
            const { type, id, attributes, relationships } = slice
            const { field_title, field_text_content, field_link } = attributes

            if (type == 'slice--cta_banner') {

                // return {
                //     "component": "cta_banner",
                //     "title": field_title,
                //     // "description": convertHtmlToJson(field_text_content.value),
                //     "description": field_text_content?.processed?.replace(/<[^>]*>/g, ''),
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

                return {
                    "post": {
                        "url": field_link?.uri,
                        "linktype": "url",
                        "fieldtype": "multilink",
                        "cached_url": field_link?.uri
                    },
                    // "image":{},
                    "title": field_title,
                    "description": field_text_content?.processed?.replace(/<[^>]*>/g, ''),
                    "alignment": "right",
                    "component": "cta_signpost",
                    "button_link": {
                        "url": field_link?.uri,
                        "linktype": "url",
                        "fieldtype": "multilink",
                        "cached_url": field_link?.uri
                    },
                    "button_text": "",
                }

            } else if (field_text_content) {

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

                        contents.push(content)

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

                        contents.push(content)
                    }

                    return contents
                }

                const { mainBody, footNotes } = parseFootnoteAndMainBody(field_text_content.processed)

                const content = {
                    "component": "rich_text",
                    "text": convertHtmlToJson(mainBody ? `<h3>${field_title ? field_title : ''}</h3>` + mainBody : ''),
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
        }).filter(content => !!content)
    }

    const bodyContent = {
        "component": "rich_text",
    }

    if (body.processed) {

        const { mainBody, footNotes } = parseFootnoteAndMainBody(body.processed)

        bodyContent.text = convertHtmlToJson(mainBody)
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

    const createDateObject = typeof created === "string" ? new Date(created) : new Date(created * 1000)
    const preparedData = {
        publish: '1',
        "story": {
            "name": title || "",
            "content": {
                // "id": uuid[0]?.value,
                "topic": topics,
                "backlog": (new Date().getFullYear() - createDateObject.getFullYear()) > 5,
                "migration_id": drupal_internal__nid,
                "content": [
                    bodyContent,
                    ...storySlices
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
                "category": [
                    "Press release"
                ],
                "component": "insight-and-analysis",
                "commissioned": false,
                "review_date": new Date(changed).toISOString().split('T')[0],
                "created_date": new Date(created).toISOString().split('T')[0],
                "time_to_read": (field_reading_time || `${calculateReadingTime(body.value)}`) + '-min read',
                "featured_image": null,
                "introduction_text": field_summary,
                "introduction_style": "standard"
            },
            "slug": slugAlias || createSlug(title),
            // "tag_list": [
            // ],
            "is_startpage": false,
            "parent_id": config.folders["press-release"], // id of a folder
            "meta_data": {
                "title": title
            }
        },
        // "links":[

        // ]
    }


    if (postAuthor) {
        preparedData.story.content.authors = [...postAuthor]
    } else if (guestAuthor.length > 0) {
        preparedData.story.content.authors = [...preparedData.story.content.authors, ...guestAuthor]
    }

    if (topics.length > 0) {
        preparedData.story.tag_list = [topics[0]]
    }

    return preparedData

}

async function main() {
    const files = await fs.readdirSync(path.join(__dirname, pressFolderPath))

    for (const file of files) {
        const data = await fs.readFileSync(path.join(__dirname, pressFolderPath, file), 'utf8')
        const parsed = JSON.parse(data)
        console.log(`Count of ${file}`,parsed.data.length)
    }

    for (const file of files) {
        const data = await fs.readFileSync(path.join(__dirname, pressFolderPath, file), 'utf8')
        await process(JSON.parse(data))
    }
}

main()

module.exports = main