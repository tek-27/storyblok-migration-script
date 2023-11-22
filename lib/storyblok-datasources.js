const Storyblok = require('storyblok-js-client')

const getDataSourceByID = async (id) => {
    return await Storyblok.get('spaces/606/datasource_entries', {
        "datasource_id": id
    })
}

const getDataSourceFromStoryblok = async (source) => {

    if (!source) {
        return await Storyblok.get('cdn/datasources', {})
    }

    return await Storyblok.get('cdn/datasource_entries', {
        "datasource": source
    })
}


module.exports = { getDataSourceFromStoryblok, getDataSourceByID }