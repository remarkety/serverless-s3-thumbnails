// dependencies
const AWS = require('aws-sdk');
const util = require('util');
const gm = require('gm').subClass({ imageMagick: true });
const s3 = new AWS.S3();

const performResize = (buffer, imageType, setWidth, setHeight) => {
    console.log("performResize to " + setWidth + " x " + setHeight);
    return new Promise ( (resolve, reject) => {
        gm(buffer).size(function(err, size) {
            // Infer the scaling factor to avoid stretching the image unnaturally.
            const scalingFactor = Math.min(
                setWidth / size.width,
                setHeight / size.height
            );
            const width  = scalingFactor * size.width;
            const height = scalingFactor * size.height;

            // Transform the image buffer in memory.
            this.resize(width, height)
                .toBuffer(imageType, function(err, buffer) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            mime: imageType,
                            buffer: buffer
                        });
                    }
                });
        });
    });
}

module.exports.resize = async (event, context) => {
    return new Promise( async (resolve, reject) => {
        // Read options from the event.
        console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));

        let thumbDirSuffix = process.env.THUMB_DIR_SUFFIX;

        const thumbWidth = process.env.WIDTH == undefined ? 100 : process.env.WIDTH;
        const thumbHeight = process.env.HEIGHT == undefined ? 100 : process.env.HEIGHT;

        if (typeof(thumbDirSuffix) == "undefined")
            thumbDirSuffix = "-thumb";

        const srcBucket = event.Records[0].s3.bucket.name;
        // Object key may have spaces or unicode non-ASCII characters.
        const srcKey    =
            decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
        const srcKeyParts = srcKey.split("/");
        const srcRootDirectory = srcKeyParts[0];
        if (srcRootDirectory.endsWith(thumbDirSuffix)) {
            console.log("Received an event for the thumbnail directory - ignoring")
            return;
        }
        const dstDirectory = srcRootDirectory + thumbDirSuffix;
        console.log(srcKeyParts);
        console.log(srcKeyParts.slice(1));

        const dstKey = [dstDirectory].concat(srcKeyParts.slice(1)).join('/');

        // Infer the image type.
        const typeMatch = srcKey.match(/\.([^.]*)$/);
        if (!typeMatch) {
            return { message: 'Could not determine the image type.'};
        }
        const imageType = typeMatch[1];
        if (imageType != "jpg" && imageType != "png" && imageType != "gif") {
            return { message: 'Unsupported image type: ${imageType}'};
        }

        const eventName = event.Records[0].eventName;
        if (eventName == 'ObjectCreated:Put') {
            console.log("Resizing " + srcKey + " into " + dstKey);

            const options = {
                Bucket: srcBucket,
                Key: srcKey
            };
            const s3Object = await s3.getObject(options).promise();
            const resized = await performResize(s3Object.Body, imageType, thumbWidth, thumbHeight);
            console.log("Uploading to s3://" + srcBucket + ":" + dstKey);

            await s3.putObject({
                Bucket: srcBucket,
                Key: dstKey,
                ContentType: resized.mime,
                Body: resized.buffer
            }).promise();

            console.log("Resize successful");
        }
        if (eventName == 'ObjectRemoved:Delete') {
            console.log(srcKey + " was deleted - removing thumbnail from " + dstKey);
            await s3.deleteObject({
                Bucket: srcBucket,
                Key: dstKey
            }).promise();
            console.log("Thumbnail deleted");
        }
        resolve();
    });
};