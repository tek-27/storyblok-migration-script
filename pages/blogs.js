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

const blogsRelatedData = require('../data/processed/processed-blogs.json')
const blogsFolderPath = '../data/raw/blogs'

async function process({ data: blogs, included }) {

    const errors = []
    try {
        let i = 0;
        const reversedBlogs = [...blogs.reverse()]
        for (let blog of reversedBlogs) {
            i++;
            if (i > 10) {
                // process.exit(0);
                break;
            }
            const blogData = blog
            const data = await getPopulatedData(blogData, included)

            if (!data) {
                continue;
            }

            const existing = await getNewStoryIDFromOldID({ fullSlug: `development/${data?.story?.content?.component}/${data?.story?.slug}`, id: data?.story?.content?.id, getUUID: false })
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

            console.log(response.status)

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
        field_reading_time
    } = attributes


    if (!blogsRelatedData[drupal_internal__nid]) {
        console.log("drupal_internal__nid", drupal_internal__nid)
        return
    }


    const { field_health_topics, field_author } = relationships

    const topics = (field_health_topics?.data || []).map(({ id, meta }) => {
        const { drupal_internal__target_id: target_id } = meta
        return processedTopics[target_id]?.title[0]?.value
    }).filter(topicValue => !!topicValue)

    let staffDetails, guestAuthor = [], postAuthor = []

    if (field_author?.data?.length > 0) {

        for (const author of field_author.data) {

            const internalId = author.meta.drupal_internal__target_id

            staffDetails = staffs[internalId]
            const newAuthor = await getNewStoryIDFromOldID({ fullSlug: `development/staff/${createSlug(staffDetails.title)}`, getAll: true })
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
        storySlices = pageSlicesData.map(slice => {
            const { type, id, attributes, relationships } = slice
            const { field_title, field_text_content, field_link } = attributes

            if (type == 'slice--cta_banner') {
                return {
                    "component": "cta_banner",
                    "title": field_title,
                    // "description": convertHtmlToJson(field_text_content.value),
                    "description": field_text_content?.processed?.replace(/<[^>]*>/g, ''),
                    "button": [
                        {
                            link: {
                                "url": field_link?.uri,
                                "target": "_blank",
                                "linktype": "url",
                                "fieldtype": "multilink",
                            },
                            label: field_link?.title,
                            "component": "button"
                        }
                    ]
                }
            } else if (field_text_content) {

                return {
                    "component": "rich_text",
                    "text": convertHtmlToJson(field_text_content.processed ? `<h3>${field_title ? field_title : ''}</h3>` + field_text_content.processed : ''),
                    "footnotes": [

                    ],
                }

            }
        }).filter(content => !!content)
    }

    const preparedData = {
        publish: '1',
        "story": {
            "name": title || "",
            "content": {
                // "id": uuid[0]?.value,
                "topic": topics,
                "content": [
                    {
                        "component": "rich_text",
                        "text": convertHtmlToJson(body.processed),
                        "footnotes": [

                        ],
                    },

                    ...storySlices
                ],
                "summary": field_summary,
                "category": [
                    "Blog"
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
            "slug": createSlug(title),
            // "tag_list": [
            // ],
            "is_startpage": false,
            "parent_id": 393424686, // id of a folder
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

    // if (topics.length > 0) {
    //     preparedData.story.content.tag_list = [topics[0]]
    //     console.log(preparedData.story.content.tag_list)
    // }

    // if(storySlices.length > 0) {
    //     preparedData.story.content.content = { ...preparedData.story.content.content, ...storySlices }
    // }

    return preparedData

}

async function main() {
    const files = await fs.readdirSync(path.join(__dirname, blogsFolderPath))
    for (const file of files) {
        const data = await fs.readFileSync(path.join(__dirname, blogsFolderPath, file), 'utf8')
        await process(JSON.parse(data))
    }
}

module.exports = main