require("dotenv").config()

module.exports = {
     spaceID: process.env.STORYBLOK_SPACE_ID || '',
     mapiKey: process.env.STORYBLOK_MAPI_KEY || '',
     preview: process.env.STORYBLOK_PREVIEW || 'c7q2RT8lC1ppxN4A7rvn8Att',
     draftPreview: process.env.STORYBLOK_DRAFT_PREVIEW || 'c7q2RT8lC1ppxN4A7rvn8Att',
     component: {
          "insight-and-analysis": {
               parent_id: 393424686
          }
     },
     folders: {
          staff: process.env.AUTHORS_FOLDER_ID || '400030372'
     },
     assets: {
          publication: process.env.PUBLICATION_ASSETS || 337912
     }
}