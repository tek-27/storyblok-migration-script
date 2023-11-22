const { addToStoryblok } = require('../lib/addToStoryblok');
const { UploadFileToStoryblok } = require('../lib/assetUpload');
const { delay } = require('../lib/delay');
const { createSlug } = require('../helpers/general')
const { getNewStoryIDFromOldID } = require('../lib/getStoryIdfromOldId');
const { convertHtmlToJson } = require('../lib/convertHtmlToJson')
const { uuid: staffs } = require('../data/processed/processed-staff.json')
const config = require('../config/index')

async function handler(req, res) {

    const errors = []
    let count = 0;
    for (let _staff in staffs) {
        count++;

        // if (count > 5) {
        //     // process.exit(0);
        //     break;
        // }

        const staff = staffs[_staff];

        const staffData = {
            publish: '1',
            story: {
                name: staff.title,
                slug: createSlug(staff.title),
                parent_id: config.folders.staff,
                content: {
                    id: _staff,
                    role: staff.field_job_title,
                    email: staff.field_email,
                    hidden: false,
                    name: staff.title,
                    component: 'staff',

                    "content": [
                        {
                            "component": "rich_text",
                            "text": convertHtmlToJson(staff?.body?.value),
                            "footnotes": [

                            ],
                            large_paragraph: false
                        }
                    ],
                    linkedin: {
                        "id": "",
                        "url": "https://linkedin.com",
                        "linktype": "url",
                        "fieldtype": "multilink",
                        "cached_url": "https://linkedin.com"
                    },
                    featured_image: {

                    },
                    introduction_text: staff?.body?.summary,
                    introduction_style: "standard"
                },
            },
        }

        console.log("uploading ", staff.title, "...")
        const existing = await getNewStoryIDFromOldID(
            {
                fullSlug: `development/${staffData?.story?.content?.component}/${staffData?.story?.slug}`,
                id: staffData?.story?.content?.id, getUUID: false
            })
            .catch(error => error)

        if (existing?.status !== 404) {

            if (staff.image) {

                let storyblokImgObj = await UploadFileToStoryblok(staff.image, 333541);

                staffData.story.content.featured_image = {
                    ...storyblokImgObj,
                    alt: staff.title
                }

            }

            await addToStoryblok(staffData, existing).catch(error => errors.push(error));
        } else {

            if (staff.image) {

                let storyblokImgObj = await UploadFileToStoryblok(staff.image);

                staffData.story.content.featured_image = {
                    ...storyblokImgObj,
                    alt: staff.title
                }

            }

            await addToStoryblok(staffData).catch(error => {
                errors.push(error)
            });
        }

        await delay(500);
    }

    if (errors.length > 0) {
        console.log("following error occurred")
        console.error(errors)
    } else {
        console.log("uploaded successfully!!!")
    }
}

module.exports = async () => {
    await handler().catch(err => { console.log("error", err) })
}
