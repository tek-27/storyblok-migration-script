const fs = require('fs');
const path = require('path');
const nodeAlias = require('../data/raw/node-alias.json')

const handler = async () => {
    const aliasHash = {}

    for (const entry of nodeAlias) {

        if(!aliasHash.hasOwnProperty(entry.path)){
            aliasHash[entry.path] = entry.alias
        }

    }

    const filePath = path.join(__dirname, '..', 'data/processed', 'processed-node-alias.json')
    fs.writeFileSync(filePath, JSON.stringify(aliasHash, '', 2))
}
handler()
module.exports = handler