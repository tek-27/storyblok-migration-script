// const fetch = require('node-fetch');
const config = require('../config/index.js')
async function addToStoryblok(data, uuid) {
  try {

    if (uuid) {

      return await fetch(`https://mapi.storyblok.com/v1/spaces/${config.spaceID}/stories/${uuid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: config.mapiKey,
        },
        body: JSON.stringify(data),
      });

    }

    return await fetch(`https://mapi.storyblok.com/v1/spaces/${config.spaceID}/stories/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.mapiKey,
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.log(error);
  }
}
module.exports = { addToStoryblok };
