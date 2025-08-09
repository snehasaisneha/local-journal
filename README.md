# Fully Serverless Journal

This is a fully serverless web journal app that uploads your data to AWS S3. It currently only supports S3 ootb but I intend to add minio support in the future.

You can:
1. Write a journal entry.
2. Upload a photo with your journal entry.
3. Pick a mood (between -2 and 2).
4. Customise the S3 location to upload your journal entry to.
5. Save the S3 location to your browser for future use, and clear it if you want to.

## How to use

1. Fork this repository.
2. Deploy to Netlify, Vercel, or any other platform that supports static file hosting. You can also set a custom domain if you want to.
3. Create an AWS S3 bucket, and create a user with access to that bucket. Make sure the policy is set to allow the user to upload files to the bucket.
4. Get the access key and secret access key for the user.
5. Ensure the CORS is set to allow the user to upload files to the bucket.


