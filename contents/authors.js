const { addToStoryblok } = require('../lib/addToStoryblok');
const { UploadFileToStoryblok } = require('../lib/assetUpload');
const { delay } = require('../lib/delay');
const { createSlug } = require('../helpers/general')
const authors = require('../data/raw/staff.json')
const config = require('../config/index')
const { convertHtmlToJson } = require('../lib/convertHtmlToJson')

async function handler(req, res) {

    let count = 0;
    for (let _author in authors) {
        count ++;
       
        if(count > 10) {
            process.exit(0);
        }

        const author = authors[_author];

        console.log(author);

        return
        let storyblokImgObj = await UploadFileToStoryblok(author.avatar_url);
        await addToStoryblok({
            publish: '1',
            story: {
                name: author.title[0].value,
                slug: createSlug(author.title[0].value),
                parent_id: config.folders.staff,
                content: {
                    id: _author,
                    role: "",
                    email: "",
                    hidden: false,
                    name: author.title[0].value,
                    component: 'staff',
                    "content": [
                        {
                            "component": "rich_text",
                            "text": convertHtmlToJson(author.body[0].value),
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
                    introduction_text: "",
                    introduction_style: "standard"
                },
            },
        });

        await delay(1000);
    }
}

handler().then(result => { console.log(result); }).catch(err => { console.log(err) })
