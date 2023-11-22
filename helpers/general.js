function createSlug(inputString) {
    const trimmedString = inputString?.trim();
    
    if(!trimmedString){
        return ''
    }

    const slug = trimmedString
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-'); // Replace consecutive hyphens with a single hyphen

    return slug;
}

const capitalizeFirstLetter = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function calculateReadingTime(text, wordsPerMinute = 200) {
    // Count the number of words (assuming words are separated by spaces)
    const wordCount = text.split(/\s+/).length;
  
    // Calculate reading time in minutes
    const readingTime = wordCount / wordsPerMinute;
  
    // Round up to the nearest integer
    return Math.ceil(readingTime);
}

module.exports = {
    capitalizeFirstLetter,
    createSlug,
    calculateReadingTime
}