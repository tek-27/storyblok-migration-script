const fs = require('fs');
const path = require('path');
const { addToStoryblok } = require('../lib/addToStoryblok');
const { UploadFileToStoryblok } = require('../lib/assetUpload');
const { convertHtmlToJson } = require('../lib/convertHtmlToJson')
const { calculateReadingTime, createSlug } = require('../helpers/general')
const { delay } = require('../lib/delay');
const { getNewStoryIDFromOldID } = require('../lib/getStoryIdfromOldId');
const processedTopics = require('../data/processed/processed-topics.json')
const { internalId: staffs } = require('../data/processed/processed-staff.json');
const config = require('../config');

const publicationsFolderPath = '../data/raw/publications'

async function process({ data: publications, included }) {

    const errors = []
    try {
        let i = 0;
        const reversedPublications = [...publications.reverse()]

        for (let publication of reversedPublications) {
            i++;
            if (i > 4) {
                // process.exit(0);
                break;
            }
            const publicationData = publication
            const data = await getPopulatedData(publicationData, included)

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

            // console.log(JSON.stringify(data));
            // continue;

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
        field_subtitle,
        field_download_link_text
    } = attributes


    // 337912
    const { field_health_topics, field_author, field_download, field_download_summary } = relationships

    if(field_download_summary.data) {
        console.log("field_download_summary", field_download_summary.data)
    }

    let document = [];

    if(field_download?.data){
        const {id} = field_download?.data
        if(id){
            const files = included?.filter(postIncludes => id==postIncludes.id)
            for (let fileEntry of files){
                const {attributes:{name, path, changed}, relationships} = fileEntry
                const changedDate = new Date(changed)
                const formattedDate = `${changedDate.getFullYear()}-${changedDate.getMonth()>10 ? changedDate.getMonth()+1 : '0'+(changedDate.getMonth()+1)}`
                const fileURL = `https://www.kingsfund.org.uk/sites/default/files/${formattedDate}/${name}`
                console.log(fileURL)
                const checkFile = await fetch(fileURL)
                if(checkFile.status==404){
                    continue
                }
                const uploadfile = await UploadFileToStoryblok(fileURL, config.assets.publication)
                const pattern = /\((.*?)\)/;
                const matches = field_download_link_text.match(pattern)

                let title = field_download_link_text,
                fileType = name.split('.').pop() || 'PDF';
                
                if(matches.length>0) {
                    title = title.replace(matches[0],'')
                    fileType = matches[1] || fileType
                }

                document.push({
                    component: "downloads",
                    downloads: [
                        {
                            title: title,
                            component: "download_item",
                            file_type: fileType,
                            file: {...uploadfile}
                        }
                    ]
                })
            }
        }
    
    }
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
    const pageSlicesData = included?.filter(postIncludes => pageSlicesIds.includes(postIncludes.id))

    let storySlices = []
    
    if (pageSlicesData?.length > 0) {
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
                    "Publication"
                ],
                "component": "insight-and-analysis",
                "commissioned": false,
                "review_date": new Date(changed).toISOString().split('T')[0],
                "created_date": new Date(created).toISOString().split('T')[0],
                "time_to_read": `${calculateReadingTime(body.value)}-min read`,
                "featured_image": null,
                "introduction_text": field_subtitle,
                "introduction_style": "standard"
            },
            "slug": createSlug(title),
            // "tag_list": [
            // seems to have been removed
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
    }

    if (guestAuthor.length > 0) {
        if (preparedData.story.content.authors) {
            preparedData.story.content.authors = [...preparedData.story.content.authors, ...guestAuthor]
        }
        preparedData.story.content.authors = [...guestAuthor]
    }

    if(document) {
        preparedData.story.content.content = [...preparedData.story.content.content, ...document]
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
    const files = await fs.readdirSync(path.join(__dirname, publicationsFolderPath))
    for (const file of files) {
        const data = await fs.readFileSync(path.join(__dirname, publicationsFolderPath, file), 'utf8')
        await process(JSON.parse(data))
    }
}

main()

module.exports = main