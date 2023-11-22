const config = require('../config/index.js')

const blogs = require('../data/processed/processed-blogs.json')
console.log(Object.keys(blogs).length)
// async function main () {

//     const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${config.spaceID}/assets?per_page=100&search=${searchTearm}`,
//     {
//         headers: {
//             'Content-Type': 'application/json',
//             Authorization: config.mapiKey,
//           },
//     })

//     const {assets} = await res.json()

//     console.log(assets)

// }

// main()