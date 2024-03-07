import { S3Client, PutObjectAclCommand  } from "@aws-sdk/client-s3"
import dotenv from 'dotenv'

const bucketName =  process.env.BUCKET_NAME
const bucketRegion =  process.env.REGION
const accessKey =  process.env.ACCESS_KEY
const secretAccessKey =  process.env.SECRET_KEY

const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey
    },
    region: bucketRegion
});

