const fs = require('fs');
const path = require('path');
const { createSlug } = require('../helpers/general');
const { data, included } = require('../data/raw/staff.json')
const staffAvatars = require('../data/raw/staff-image.json')

module.exports = async () => {
    const staffHash = { "uuid": {}, "internalId": {} }

    for (let key = 0; key < data.length; key++) {

        const staff = data[key]

        const { id, attributes, relationships } = staff

        const { field_image } = relationships

        const { title, drupal_internal__vid: drupalId, field_job_title, body, moderation_state, metatag, field_email, field_first_name,
            field_last_name,
            field_last_review_date,
            drupal_internal__nid,
            drupal_internal__mid,
            field_meta_tags,
        } = attributes

        let image = null

        const { data: imageData } = field_image

        if (imageData) {

            const relatedData = included.filter(entry => {
                return entry.id == imageData.id
            })

            const { attributes: ImageAttributes } = relatedData.pop()

            const staffAvatar = staffAvatars[`${ImageAttributes.drupal_internal__mid}`]?.uri

            if (staffAvatar) {
                image = staffAvatar.replace('public:/', 'https://www.kingsfund.org.uk/sites/default/files/styles/media_small/public');
                let check = await fetch(image)
                if (check.status === 404) {
                    image = staffAvatar.replace('public:/', 'https://www.kingsfund.org.uk/sites/default/files/styles/avatar_100x100_/public');
                    let check = await fetch(image)
                    if (check.status === 404) {
                        image = "https://cdn.pixabay.com/photo/2016/08/08/09/17/avatar-1577909_1280.png"
                    }
                }
            } else {
                image = "https://cdn.pixabay.com/photo/2016/08/08/09/17/avatar-1577909_1280.png"
            }

            // if (ImageAttributes && ImageAttributes?.name.includes('.jpg')) {
            //     image = `https://www.kingsfund.org.uk/sites/default/files/styles/avatar_100x100_/public/field/field_person_photo/${ImageAttributes.name}`
            // }else {
            //     image = `https://www.kingsfund.org.uk/sites/default/files/styles/avatar_100x100_/public/field/field_person_photo/${createSlug(ImageAttributes.name)}.jpg`
            // }

        }else {
            image = "https://cdn.pixabay.com/photo/2016/08/08/09/17/avatar-1577909_1280.png"
        }


        if (!staffHash.uuid.hasOwnProperty(id)) {

            staffHash.uuid[id] = {
                drupalId,
                title,
                image,
                field_job_title,
                body,
                moderation_state,
                field_email,
                field_first_name,
                field_last_name,
                field_meta_tags
            }

            staffHash.internalId[drupal_internal__nid] = {
                drupalId,
                title,
                image,
                field_job_title,
                body,
                moderation_state,
                field_email,
                field_first_name,
                field_last_name,
                field_meta_tags
            }
        }
    }

    const filePath = path.join(__dirname, '..', 'data/processed', 'processed-staff.json')
    fs.writeFileSync(filePath, JSON.stringify(staffHash, '', 2))
}