const fs = require('fs');
const path = require('path');
const topics = require('../data/raw/topics.json')

module.exports = async () => {
    const topicsHash = {}

    for (let key = 0; key < topics.length; key++) {

        const topic = topics[key]

        const { uuid,
            title,
            field_content_owner,
            field_health_topics,
            metatag,
            moderation_state,
            field_promoted_items
        } = topic

        if (!topicsHash.hasOwnProperty(field_health_topics[0].target_id)) {
            topicsHash[field_health_topics[0].target_id] = {
                title,
                moderation_state
            }
        }
    }

    const filePath = path.join(__dirname, '..', 'data/processed', 'processed-topics.json')
    fs.writeFileSync(filePath, JSON.stringify(topicsHash, '', 2))
}