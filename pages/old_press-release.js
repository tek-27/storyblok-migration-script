const { addToStoryblok } = require('../lib/addToStoryblok');
const { UploadFileToStoryblok } = require('../lib/assetUpload');
const { convertHtmlToJson } = require('../lib/convertHtmlToJson')
const { calculateReadingTime, createSlug } = require('../helpers/general')
const { delay } = require('../lib/delay');
const { getNewStoryIDFromOldID } = require('../lib/getStoryIdfromOldId');
const { data: pressReleases, included } = require('../data/raw/press-release.json')
const processedTopics = require('../data/processed/processed-topics.json')
const {processedTopics:mappingTopics} = require('../lib/topicsMap')
const { internalId: staffs } = require('../data/processed/processed-staff.json');
const config = require('../config');

const currentComponent = 'insight-and-analysis'

async function main() {

    const errors = []
    try {
        
        let i = 0;
        for (let _pressRelease of [...pressReleases.reverse()]) {
            i++;

            if (i > 10) {
                // process.exit(0);
                break;
            }

            const pressReleaseData = _pressRelease

            const data = await getPopulatedData(pressReleaseData)

            const existing = await getNewStoryIDFromOldID({ fullSlug: `development/${data?.story?.content?.component}/${data?.story?.slug}`, id: data?.story?.content?.id, getUUID: false })
                .catch(error => {
                    if (error.status === 404) {
                        return undefined;
                    }
                    console.log(error)
                    throw new CustomError(error.message, error?.status, error?.response)
                })

            console.log("uploading ", data.story.name, "...")

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

        console.log("Error", err)

    }

}

const getPopulatedData = async ({ attributes, relationships }) => {

    const { drupal_internal__nid,
        drupal_internal__vid,
        langcode,
        revision_timestamp,
        revision_log,
        status,
        title,
        created,
        changed,
        promote,
        sticky,
        default_langcode,
        revision_translation_affected,
        moderation_state,
        metatag,
        path,
        rh_action,
        rh_redirect,
        rh_redirect_response,
        rh_redirect_fallback_action,
        sae_exclude,
        body,
        field_author_name,
        field_content_owner,
        field_last_review_date,
        field_meta_tags,
        field_next_review_date,
        field_review_exclude,
        field_scheduled_publish,
        field_subtitle,
        field_summary,
        field_reading_time,
    } = attributes

    const {field_slices, field_health_topics} = relationships
    const notesToAuthors = (field_slices?.data || []).filter(fieldSlice => fieldSlice.type === 'slice--notes_to_editors')

    const relatedData = included.filter(entry => {
        return entry.id == notesToAuthors[0]?.id
    }).pop()

    const {attributes:noteToAuthorData} = relatedData
    // const fieldHealthTopicTaxonomy = field_health_topics?.data?.filter(fieldHealthTopic => fieldHealthTopic.type == "taxonomy_term--topics")
    
    // if( topicInternalId = fieldHealthTopicTaxonomy[0]?.meta?.drupal_internal__target_id) {
    //     topic = processedTopics[topicInternalId]?.title[0]?.value
    // }

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
        if (mappingTopics.hasOwnProperty(topicValue)) {
            return mappingTopics[topicValue]
        }
        return topicValue
    }).filter(topicValue => !!topicValue)

    return {
        publish: '1',
        "story": {
            "name": title || "",
            "content": {
                "topic": [...topics],
                "migration_id": drupal_internal__nid,
                "content": [
                    {
                        "component": "rich_text",
                        "text": convertHtmlToJson(body.value),
                        "footnotes": [

                        ],
                    },

                    {
                        "component": "rich_text",
                        "text": convertHtmlToJson( noteToAuthorData?.field_text_content?.value ? "<h3>Notes to editors</h3>" + noteToAuthorData.field_text_content?.value : ""),
                        "footnotes": [

                        ],
                    },
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
                "summary": field_summary || body?.summary || "",
                "category": [
                    "Press release"
                ],
                "component": "insight-and-analysis",
                "commissioned": false,
                "review_date": typeof changed === 'string' ? new Date(changed).toISOString().split('T')[0] : new Date(changed*1000).toISOString().split('T')[0],
                "created_date": typeof created === 'string' ? new Date(created).toISOString().split('T')[0] : new Date(created*1000).toISOString().split('T')[0],
                "time_to_read": (field_reading_time || `${calculateReadingTime(body.value)}`) + '-min read',
                "featured_image": null,
                "introduction_text": field_summary,
                "introduction_style": "standard"
            },
            "slug": createSlug(title),
            // "tag_list": [
            //     topic
            // ],
            "is_startpage": false,
            "parent_id": config.component[currentComponent].parent_id, // id of a folder
            "meta_data": {
                "title": createSlug(title)
            }
        },
    }

}

main();
module.exports = main