const sharp = require('sharp');

async function optimizeImage(buffer) {
  try {
    return await sharp(buffer)
      .jpeg({
        quality: 85,
        progressive: true
      })
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .rotate()
      .toBuffer();
  } catch (error) {
    console.error('Error optimizing image:', error);
    throw new Error('Failed to process image');
  }
}

async function optimizeImages(files) {
  const processedImages = {};
  for (const [key, fileArray] of Object.entries(files)) {
    if (fileArray && fileArray[0]) {
      processedImages[key] = await optimizeImage(fileArray[0].buffer);
    }
  }
  return processedImages;
}

module.exports = {
  optimizeImage,
  optimizeImages
};