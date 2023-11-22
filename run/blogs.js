const staffImageExport = require('../tests/exportToJson.js')

const staffProcessor = require('../processor/staff.js')

const staffUploader = require('../contents/staff.js')

const blogsUploader = require('../pages/blogs.js')

async function run() {

    const commands = process.argv;

    const scripts = {
        exportStaffImage: staffImageExport,
        processStaff: staffProcessor,
        uploadStaff: staffUploader,
        uploadBlogs: blogsUploader
    }

    for (let i = 2; i < process.argv.length; i++) {
        const scriptName = commands[i];
        console.log(`Executing ${scriptName}()...`)
        await scripts[scriptName]()
    }
}

run()