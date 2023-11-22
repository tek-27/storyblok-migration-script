// const fetch = require('node-fetch');
const FormData = require('form-data');
const config = require('../config');

let spaceID = config.spaceID;
let mapiKey = config.mapiKey;

async function UploadFileToStoryblok(fileUrl, folderId = null) {
  if (!fileUrl) {
    return;
  }
  let splitFile = fileUrl?.split('/');
  let fileName = splitFile[splitFile.length - 1];
  try {

    const existingAsset = await checkAsset(fileName);

    if (existingAsset) {
      if (existingAsset.filename.includes('https://s3.amazonaws.com')) {
        console.log("coming to check")
        existingAsset.filename = existingAsset.filename.replace('https://s3.amazonaws.com/', 'https://')
      }

      return {
        filename: existingAsset.filename,
        id: existingAsset.id,
        alt: '',
        name: '',
        focus: '',
        title: '',
        source: '',
        copyright: '',
        fieldtype: 'asset',
        meta_data: {},
        is_external_url: false,
      };
    }

    const payload = {
      filename: fileName,
      size: '400x500'
    }
    if (folderId) {
      payload.asset_folder_id = folderId
    }
    let response = await fetch(
      `https://mapi.storyblok.com/v1/spaces/${spaceID}/assets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: mapiKey,
        },
        body: JSON.stringify(payload),
      }
    );
    let data = await response.json();
    let fetchImage = await fetch(fileUrl);
    let imgBuffer = Buffer.from(await fetchImage.arrayBuffer());
    await fileUpload(data, imgBuffer);
    let filename = `https://a.storyblok.com/${data.fields.key}`;

    return {
      filename,
      id: data.id,
      alt: '',
      name: '',
      focus: '',
      title: '',
      source: '',
      copyright: '',
      fieldtype: 'asset',
      meta_data: {},
      is_external_url: false,
    };

  } catch (error) {
    console.log(error.message, error);
  }
}

async function fileUpload(signed_request, file) {
  const form = new FormData();
  for (let key in signed_request.fields) {
    form.append(key, signed_request.fields[key]);
  }
  form.append('file', file);
  form.submit(signed_request.post_url, function (err, res) {
    if (err) throw err;
  });
}

async function checkAsset(searchTerm) {
  const res = await fetch(`https://mapi.storyblok.com/v1/spaces/${config.spaceID}/assets?per_page=100&search=${searchTerm}`,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.mapiKey,
      },
    })

  const { assets } = await res.json()
  if (assets.length > 0) {
    return assets[0];
  }

  return false
}

module.exports = { UploadFileToStoryblok };
