const { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const env = require('../config/env')

const s3 = new S3Client({
  endpoint: env.s3.endpoint,
  region: env.s3.region,
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey,
  },
  forcePathStyle: env.s3.forcePathStyle,
})

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.s3.bucket }))
  } catch (err) {
    await s3.send(new CreateBucketCommand({ Bucket: env.s3.bucket }))
  }
}

async function putObject(key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
  return key
}

async function getSignedDownloadUrl(key, expiresInSeconds = 300) {
  const command = new GetObjectCommand({ Bucket: env.s3.bucket, Key: key })
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
}

module.exports = { s3, ensureBucket, putObject, getSignedDownloadUrl }
