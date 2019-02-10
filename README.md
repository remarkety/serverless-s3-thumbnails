# serverless-s3-thumbnails
A serverless lambda ImageMagick-based S3 thumbnail creator.

## Overview
As opposed to the usual S3 resizers which use imagemagick and create thumbnails
in a separate bucket, this project uses a single bucket, with one "top-level" directory
being the source, and another being the target.

This project also deletes the thumbnail if the original image is removed.

The "source" directory needs to be "top-level", ie no slashes.
The "destination" directory will be the same as "source", plus an additional prefix (default is "-thumb").

For example, if the image was uploaded into `<bucket>:/src/dir1/dir2/image.jpg`, the thumbnail
will be saved to: `<bucket>:/src-thumb/dir1/dir2/image.jpg`;

## Configuration
The function accepts the following configuration via environment variables:

| Variable | Purpose | Default Value |
|----------|---------|---------------|
|`THUMB_DIR_SUFFIX`| The suffix to append to the src dir in order to set the dstDir | -thumb |
|`WIDTH` | The thumbnail max width | 100 |
|`HEIGHT` | The thumbnail max height | 100 |

## Deployment
Install dependencied and deploy:
```
npm install
serverless deploy
```

Once deployed, you need to setup your own S3 triggers on the lambda function.
This is because `servless` doesn't support creating triggers on existing buckets very well.

- To enable creation of thumbnails, enable the "S3 / ObjectCreated" trigger.
- To automatically delete thumbnails when the originals are removed, enable the "S3 / OBjectRemoved" trigger as well. 

You also need to make sure that the lamda role includes `GetObject` and `PutObject` permissions on the bucket. 
Here's an example policy:

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::my-image-bucket",
                "arn:aws:s3:::my-image-bucket/*"
            ]
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": [
                "s3:GetAccountPublicAccessBlock",
                "s3:ListAllMyBuckets",
                "s3:HeadBucket"
            ],
            "Resource": "*"
        }
    ]
}
```
 