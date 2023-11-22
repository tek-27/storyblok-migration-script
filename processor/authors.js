const fs = require('fs');
const path = require('path');
const authors = require('../data/authors.json')

module.exports = async () => {
    const authorsUUIDValueHash = {}

    for (let key = 0; key < authors.length; key++) {
        const author = authors[key]
        const { uuid, title, field_image, field_job_title, body, moderation_state } = author
        if (!authorsUUIDValueHash.hasOwnProperty(uuid[0].value)) {
            authorsUUIDValueHash[uuid[0].value] = {
                title,
                field_image,
                field_job_title,
                body,
                moderation_state
            }
        }
    }

    const filePath = path.join(__dirname, '..', 'data/processed', 'processed-authors.json')
    fs.writeFileSync(filePath, JSON.stringify(authorsUUIDValueHash, '', 2))
}