const fs = require('fs');
const path = require('path');
const { addToStoryblok } = require('../lib/addToStoryblok');
const { UploadFileToStoryblok } = require('../lib/assetUpload');
const { convertHtmlToJson } = require('../lib/convertHtmlToJson')
const { calculateReadingTime, createSlug } = require('../helpers/general')
const { delay } = require('../lib/delay');
const { getNewStoryIDFromOldID, getStoryWithMigrationID } = require('../lib/getStoryIdfromOldId');
const processedTopics = require('../data/processed/processed-topics.json')
const {processedTopics:mappingTopics} = require('../lib/topicsMap')
const { internalId: staffs } = require('../data/processed/processed-staff.json');
const config = require('../config');
const nodeAlias = require('../data/processed/processed-node-alias.json')

const publicationsFolderPath = '../data/raw/publications'
const publicationType = require('../lib/publicationType')

async function process({ data: publications, included }) {

    const errors = []
    try {
        let i = 0;
        const reversedPublications = [...publications.reverse()]

        for (let publication of reversedPublications) {
            i++;
            if (i > 1) {
                // process.exit(0);
                break;
            }
            const publicationData = publication
            const data = await getPopulatedData(publicationData, included)

            if (!data) {
                continue;
            }

            const type = data?.story?.content?.category[0]

            if (!type) {
                console.log(`skipped for ${data.story.name}`)
                continue
            }


            if (type) {

                if(!config.component.publications.slug_directories[type]){
                    console.log(`Skipping... config value not found for ${type}`)
                    continue
                }

                const existing = await getStoryWithMigrationID({ folder: 'insight-and-analysis', id: data?.story?.content?.migration_id, getUUID: false })
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
        field_download_link_text,
        field_download_summary_link_text,
        field_meta_tags,
        path
    } = attributes

    const slug = path?.alias.split('/')
    const slugAlias = slug.reverse()[0]
    console.log(slugAlias)


    // 337912
    const { 
        field_health_topics,
        field_author,
        field_download,
        field_download_summary,
        field_report_type 
    } = relationships

    let document = [];

    const {drupal_internal__target_id:publicationTypeId} = field_report_type?.data?.meta
    
    if(!publicationType[publicationTypeId]){
        console.log("publicationType not found", title)
        return false
    }

    const category = publicationType[publicationTypeId] ? publicationType[publicationTypeId].category : 'Publication'

    if(field_download?.data){
        const { id } = field_download?.data
        if(id){
            const files = included?.filter(postIncludes => id==postIncludes.id)
            for (let fileEntry of files){
                const {attributes:{name, path, changed}, relationships} = fileEntry
                const changedDate = new Date(changed)
                const formattedDate = `${changedDate.getFullYear()}-${changedDate.getMonth()>10 ? changedDate.getMonth()+1 : '0'+(changedDate.getMonth()+1)}`
                const fileURL = `https://www.kingsfund.org.uk/sites/default/files/${formattedDate}/${name}`
                const checkFile = await fetch(fileURL)
                if(checkFile.status==404){
                    continue
                }
                const uploadfile = await UploadFileToStoryblok(fileURL, config.assets.publication)
                const pattern = /\((.*?)\)/;
                const matches = field_download_link_text?.match(pattern)

                let title = field_download_link_text || 'File',
                fileType = name.split('.').pop() || 'PDF';
                
                if(matches?.length>0) {
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
    
    // need to do &include=field_download_summary while getting data
    if(field_download_summary?.data){
        const { id } = field_download_summary.data
        if(id){
            const files = included?.filter(postIncludes => id==postIncludes.id)
            for (let fileEntry of files){
                const {attributes:{name, path, changed}, relationships} = fileEntry
                const changedDate = new Date(changed)
                const formattedDate = `${changedDate.getFullYear()}-${changedDate.getMonth()>10 ? changedDate.getMonth()+1 : '0'+(changedDate.getMonth()+1)}`
                const fileURL = `https://www.kingsfund.org.uk/sites/default/files/${formattedDate}/${name}`
                const checkFile = await fetch(fileURL)
                if(checkFile.status==404){
                    console.log("file doesn't exists", fileURL)
                    continue
                }
                const uploadfile = await UploadFileToStoryblok(fileURL, config.assets.publication)
                const pattern = /\((.*?)\)/;
                const matches = field_download_summary_link_text?.match(pattern)

                let title = field_download_summary_link_text || 'File',
                fileType = name.split('.').pop() || 'PDF';
                
                if(matches?.length>0) {
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
        if(!topicValue){
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
            
            if (!author) {
                return
            }

            return {
                "name": author,
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

                const button = []
                if(field_link?.uri) {
                    
                    let ctaUrl = field_link?.uri
                    if (!field_link.uri.match(/https?:\/\//)) {
                        const entity = field_link.uri.split(':')
                        const alias = `https://www.kingsfund.org.uk${nodeAlias[`/${entity[1]}`]}`
                        console.log("alias", alias)
                        ctaUrl = alias
                    } else {
                        if (field_link.uri.includes('http')) {
                            ctaUrl = field_link.uri
                        } else {
                            console.log("didn't match", field_link.uri.match(/https?:\/\//))
                        }
                    }

                    button.push(
                        {
                            link: {
                                "url": ctaUrl,
                                "target": "_blank",
                                "linktype": "url",
                                "fieldtype": "multilink",
                                cached_url: ctaUrl
                            },
                            label: field_link?.title,
                            "component": "button"
                        }
                    )
                }

                return {
                    "component": "cta_banner",
                    "title": field_title,
                    // "description": convertHtmlToJson(field_text_content.value),
                    "description": field_text_content?.processed?.replace(/<[^>]*>/g, ''),
                    "button": [...button]
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

    const createDateObject = typeof created === "string" ? new Date(created) : new Date(created * 1000)
    const preparedData = {
        publish: '1',
        "story": {
            "name": title || "",
            "content": {
                // "id": uuid[0]?.value,
                "topic": topics,
                "migration_id": drupal_internal__nid,
                "backlog": (new Date().getFullYear() - createDateObject.getFullYear()) > 5,
                "content": [
                    {
                        "component": "rich_text",
                        "text": convertHtmlToJson(body.processed),
                        "footnotes": [

                        ],
                    },

                    ...storySlices
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
                "category": [
                    category
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
            "slug": slugAlias || createSlug(title),
            // "tag_list": [
            // seems to have been removed
            // ],
            "is_startpage": false,
            "parent_id": publicationType[publicationTypeId].folderId, // id of a folder
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
        if (postAuthor.length > 0) {
            preparedData.story.content.authors = [...postAuthor, ...guestAuthor]
        }else {
            preparedData.story.content.authors = [...guestAuthor]
        }
    }

    if(document.length > 0) {
        preparedData.story.content.content = [...document, ...preparedData.story.content.content]
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
        console.log(file)
        const data = await fs.readFileSync(path.join(__dirname, publicationsFolderPath, file), 'utf8')
        await process(JSON.parse(data))
    }
}

main()

module.exports = main