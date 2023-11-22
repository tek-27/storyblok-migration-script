const topics = require('../data/processed/processed-topics.json')
const config = require('../config/index.js')
const { delay } = require('../lib/delay')

async function uploadDataSources() {

    const idOrSlug = 'topics';

    let count = 0;

    // const topics = await fetch(`https://mapi.storyblok.com/v1/spaces/${config.spaceID}/datasource_entries?datasource_id=242870`, {
    //     method: 'GET',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         Authorization: config.mapiKey,
    //     }
    // });

    // const topicsJson = await topics.json();

    // console.log(topicsJson)

    // return;

    for (let key in topics) {

        count++;

        // if (count > 10) {
        //     break;
        // }

        await delay(500)

        const topic = topics[key]

        let topicTitle = topic.title[0].value

        // const existing = await fetch(`https://mapi.storyblok.com/v1/spaces/${config.spaceID}/datasource_entries/${key}`, {
        //     method: 'GET',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         Authorization: config.mapiKey,
        //     }
        // })

        const data = {
            "datasource_entry": {
                "id": key,
                "name": topicTitle,
                "value": topicTitle,
                "datasource_id": 242870
            }
        }

        const create = await fetch(`https://mapi.storyblok.com/v1/spaces/${config.spaceID}/datasource_entries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: config.mapiKey,
            },
            body: JSON.stringify(data),
        })

        const createJson = await create.json()

        // if (existing.status !== 404) {

        //     const existingJson = await existing.json()
        //     console.log(existingJson)

        //     const update = await fetch(`https://mapi.storyblok.com/v1/spaces/${config.spaceID}/datasource_entries/${datasource_entry.id}`, {
        //         method: 'PUT',
        //         headers: {
        //             'Content-Type': 'application/json',
        //             Authorization: config.mapiKey,
        //         },
        //         body: JSON.stringify(data),
        //     })

        //     console.log(update)

        // } else {

        //     const create = await fetch(`https://mapi.storyblok.com/v1/spaces/${config.spaceID}/datasource_entries`, {
        //         method: 'POST',
        //         headers: {
        //             'Content-Type': 'application/json',
        //             Authorization: config.mapiKey,
        //         },
        //         body: JSON.stringify(data),
        //     })

        //     const createJson = await create.json()
        //     console.log(createJson)

        // }
    }

}

module.exports = {
    uploadDataSources
}