const { addToStoryblok } = require('../lib/addToStoryblok');
const { delay } = require('../lib/delay');

async function handler(req, res) {
  let response = await fetch(
    'https://raw.githubusercontent.com/dipankarmaikap/fake-json-data/main/tags.json'
  );
  let tags = await response.json();
  for (let tag of tags) {
    await addToStoryblok({
      publish: '1', //you can add false value if you want this to be draft
      story: {
        name: tag.name,
        slug: tag.slug,
        parent_id: 328808329, // This will be your tags Folder id
        content: {
          id: tag.id,
          name: tag.name,
          component: 'tag',
          description: tag.description,
        },
      },
    });
    await delay(500);
  }
  res.status(200).json({ message: 'Success!' });
}

module.exports = handler;
