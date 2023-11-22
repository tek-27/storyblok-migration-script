const fs = require('fs');
const path = require('path');
const blogs = require('../data/raw/blogs.json')

const blogProcessor = async () => {
    const blogsUUIDValueHash = {}

    for (let key = 0; key < blogs.length; key++) {
        const blog = blogs[key]
        const { uuid, nid, vid} = blog
        if (!blogsUUIDValueHash.hasOwnProperty(nid[0].value)) {
            blogsUUIDValueHash[nid[0].value] = blog
        }
    }

    const filePath = path.join(__dirname, '..', 'data/processed', 'processed-blogs.json')
    await fs.writeFileSync(filePath, JSON.stringify(blogsUUIDValueHash, '', 2))
}

blogProcessor()

module.exports = blogProcessor

