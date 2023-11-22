const StoryBlokClient = require('storyblok-js-client')
const config = require('../config/index.js')
const getNewStoryIDFromOldID = async function ({ fullSlug, getUUID, getAll }) {

    /**
     * Direct Api for getting the content from Storyblok
     */

    // let url = `https://api.storyblok.com/v2/cdn/stories/${startsWith}?token=${config.draftPreview}&version=draft`
    // let res = await fetch(url)
    // let data = await res.json()
    // return data;
    // let StoryID = data?.stories[0]?.uuid
    // return StoryID
    //...

    const StoryBlok = new StoryBlokClient({
        accessToken: config.mapiKey,
    })

    const { data } = await StoryBlok.get(`cdn/stories/${fullSlug}`, {
        token: config.draftPreview,
        "version": "draft"
    })

    if(getAll) {
        return data
    }

    if (getUUID) {
        return data?.story?.uuid
    }

    return data?.story?.id

}

const getNewStoryIDFromOldIDDraft = async function ({ startsWith, id }) {
    let url = `https://api.storyblok.com/v2/cdn/stories/&{full_slug}?token=${config.draftPreview}&filter_query\[id\][in]=${id}&starts_with=${startsWith}/`
    let res = await fetch(url)
    let data = await res.json()
    let StoryID = data?.stories[0]?.uuid
    return StoryID
}

module.exports = { getNewStoryIDFromOldID, getNewStoryIDFromOldIDDraft }