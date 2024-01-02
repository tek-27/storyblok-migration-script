const fs = require('fs');
const path = require('path');
const { addToStoryblok } = require('../lib/addToStoryblok');
const { UploadFileToStoryblok } = require('../lib/assetUpload');
const { convertHtmlToJson, breakIframe } = require('../lib/convertHtmlToJson')
const { calculateReadingTime, createSlug } = require('../helpers/general')
const { delay } = require('../lib/delay');
const { getNewStoryIDFromOldID } = require('../lib/getStoryIdfromOldId');
const processedTopics = require('../data/processed/processed-topics.json')
const {processedTopics:mappingTopics} = require('../lib/topicsMap')
const { internalId: staffs } = require('../data/processed/processed-staff.json');
const podcastsFolderPath = '../data/raw/projects'
const { parser } = require('../lib/parser');
const nodeAlias = require('../data/processed/processed-node-alias.json')
const config = require('../config')

let i = 0;

async function process({ data: podcasts }) {

    const errors = []
    try {
        
        const reversedpodcasts = [...podcasts.reverse()]

        for (let publication of reversedpodcasts) {
            i++;
            // if (i > 2) {
            //     break;
            // }
            const publicationData = publication
            const data = await getPopulatedData(publicationData)

            if (!data) {
                continue;
            }

            const existing = await getNewStoryIDFromOldID({ fullSlug: `${config.environment}/${config.component.projects.slug_directory}/${data?.story?.slug}`, id: data?.story?.content?.id, getUUID: false })
                .catch(error => {
                    if (error.status === 404) {
                        return undefined;
                    }
                    console.log("RRRRRRRR", error)
                    throw new CustomError(error.message, error?.status, error?.response)
                })

            console.log(`uploading ${i} th`,data.story.name, "...")

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

const getPopulatedData = async (data) => {

    let {
        drupal_internal__nid,
        drupal_internal__vid,
        title,
        created,
        changed,
        body,
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
        field_meta_tags
    } = data

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
        if(!imageExistenceCheck.status === 404) {
            const upload = await UploadFileToStoryblok(SEO.og_image)
            SEO.og_image = upload.filename
        }
    }

    if (og_title) {
        SEO.og_title = og_title.replace(/\[node:title\]/g, title)
    }

    const topics = (field_health_topics?.data || []).map(({ id, meta }) => {
        const { drupal_internal__target_id: target_id } = meta
        const topicValue = processedTopics[target_id]?.title[0]?.value
        if (mappingTopics.hasOwnProperty(topicValue.toLowerCase())) {
            return mappingTopics[topicValue.toLowerCase()]
        }
        return topicValue
    }).filter(topicValue => !!topicValue)


    let staffDetails, guestAuthor = [], postAuthor = []

    /**
     * handling author of this post
     */
    if (field_author?.length > 0) {

        for (const author of field_author) {

            const internalId = author.meta.drupal_internal__target_id

            staffDetails = staffs[internalId]
            console.log("Staffs",staffDetails)
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

    /**
     * handling guest author of this post
     */
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

    let storyContents = [], storySlices = []

    if (body?.processed) {
        if (body?.processed.includes('iframe')) {

            storyContents.push({
                "component": "iframe_embed",
                "iframe_embed": body.processed,
            })

        } else {
            storyContents.push({
                "component": "rich_text",
                "text": convertHtmlToJson(body.processed),
                "footnotes": [

                ],
            },)
        }

    }

    if (pageSlicesData?.length > 0) {
        storySlices = (await Promise.all(pageSlicesData.flatMap(async slice => {

            const { type, id, field_title, field_text_content, field_link, field_content_items, field_teaser_item } = slice

            /**
             * handling different types of slices
             * and accordians
             */
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

            }
            else if (['slice--accordion', 'paragraph--accordion_item'].includes(type)) {

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


            }
            else if (field_text_content) {

                /**
                 * handling if the slice is an iframe
                 */
                if (field_text_content?.processed.includes('iframe')) {

                    if (field_text_content.processed.includes('data-src')) {
                        const content = parser(field_text_content.processed)
                        return {
                            "component": "iframe_embed",
                            "iframe_embed": content ? `<h3>${field_title ? field_title : ''}</h3>` + content : '',
                        }
                    }

                    return {
                        "component": "iframe_embed",
                        "iframe_embed": field_text_content.processed ? `<h3>${field_title ? field_title : ''}</h3>` + field_text_content.processed : '',
                    }
                }

                /**
                 * handling if the slice is a rich text
                 */
                const richText = convertHtmlToJson(field_text_content.processed ? `<h3>${field_title ? field_title : ''}</h3>` + field_text_content.processed : '')

                /**
                 * handling if the slice/accordian is a transcript
                 */
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

                if (richText?.content) {
                    return {
                        "component": "rich_text",
                        "text": richText,
                    }
                }

            }
            else if (field_content_items?.length > 0 && type == 'slice--people') {
                return {
                    title: field_title,
                    component: "staff_info",
                    authors: await Promise.all(field_content_items.map(async person => {

                        const { field_link } = person

                        if (!field_link) {

                            return {
                                "link": {
                                    "id": "",
                                    "url": "",
                                    "linktype": "story",
                                    "fieldtype": "multilink",
                                    "cached_url": ""
                                },
                                "profile_picture": {
                                    "alt":"\"Default Staff Avatar\"",
                                    "filename":config.assets.staffs.default,
                                },
                                "name": person.field_heading,
                                "position": person.field_sub_heading,
                                "component": "guest_author",
                            }

                        }

                        const internalId = field_link?.uri?.split('/')[1]

                        let details = staffs[`${internalId}`]

                        /**
                         * need to handle the team for this projects
                         */
                        if (!details) {
                            return
                        }

                        const newAuthor = await getNewStoryIDFromOldID({ fullSlug: `${config.environment}/${config.component.staff.slug_directory}/${createSlug(details.title)}`, getAll: true })
                            .catch(error => {
                                console.log("author fetch error", error)
                                return false;
                            });

                        if (newAuthor) {
                            return {
                                "_uid": newAuthor?.story?.uuid,
                                "author": {
                                    "id": newAuthor?.story?.uuid,
                                    "url": "",
                                    "linktype": "story",
                                    "fieldtype": "multilink",
                                    "cached_url": newAuthor?.story?.full_slug
                                },
                                "component": "author"
                            }
                        }
                    }))
                }
            }
            // this section will handle the existing teaser posts
            // in the project page
            else if (field_teaser_item) {
                const  {field_teaser_item} = slice
            }

        }))).filter(content => !!content)
    }

    /**
     * preparing the data
     */
    
    const createDateObject = typeof created === "string" ? new Date(created) : new Date(created * 1000)
    const preparedData = {
        publish: '1',
        "story": {
            "name": title || "",
            "content": {
                "migration_id": drupal_internal__nid,
                "topic": topics,
                "backlog": (new Date().getFullYear() - createDateObject.getFullYear()) > 5,
                "content": [
                    ...storyContents, ...storySlices
                ],
                seo: [
                    {
                        "fields": {
                            ...SEO,
                            "plugin":"seo_metatags",
                        },
                        "noindex": false,
                        "nofollow": false,
                        "component": "seo",
                    }
                ],
                "summary": field_summary,
                "component": "insight-and-analysis",
                "commissioned": false,
                "review_date": typeof changed === "string" ? changed.split('T')[0] : new Date(changed*1000).toISOString().split('T')[0],
                "created_date": typeof created === "string" ? created.split('T')[0] : new Date(created*1000).toISOString().split('T')[0],
                "time_to_read": field_multimedia_meta,
                "featured_image": null,
                "introduction_text": field_subtitle,
                "introduction_style": "standard"
            },
            "slug": createSlug(title),
            "is_startpage": false,
            "parent_id": config.folders.projects, // id of a folder
            "meta_data": {
                "title": title
            }
        }
    }

    // const multimediaTypeId = field_multimedia_type?.meta?.drupal_internal__target_id

    // if (multimediaTypeId) {
    //     preparedData.story.content.category = [
    //         contentTypes[multimediaTypeId]
    //     ]
    // }

    preparedData.story.content.category = ["Projects"]


    if (postAuthor) {
        preparedData.story.content.authors = [...postAuthor]
    }

    /**
     * handling guest author name
     */
    if (guestAuthor.length > 0) {
        if (preparedData.story.content.authors) {
            preparedData.story.content.authors = [...preparedData.story.content.authors, ...guestAuthor]
        }
        preparedData.story.content.authors = [...guestAuthor]
    }

    if (document.length > 0) {
        preparedData.story.content.content = [...preparedData.story.content.content, ...document]
    }

    return preparedData

}

async function main() {
    const files = await fs.readdirSync(path.join(__dirname, podcastsFolderPath))
    for (const file of files) {
        const data = await fs.readFileSync(path.join(__dirname, podcastsFolderPath, file), 'utf8')
        await process(JSON.parse(data))
    }
}

main()

module.exports = main