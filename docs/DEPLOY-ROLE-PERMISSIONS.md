# Deploy Role Permissions (S3 + CloudFront)

Replace the `AmplifyBackendDeployFullAccess` managed policy on both roles with this inline policy.

## For `GitHubDeployDevRole`

Go to: IAM -> Roles -> GitHubDeployDevRole -> Permissions -> Add permissions -> Create inline policy -> JSON

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Deploy",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::phantomwall-frontend-dev-469440861178",
        "arn:aws:s3:::phantomwall-frontend-dev-469440861178/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidate",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "*"
    }
  ]
}
```

## For `GitHubDeployDemoRole`

Same steps but with the demo bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Deploy",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::phantomwall-frontend-demo-469440861178",
        "arn:aws:s3:::phantomwall-frontend-demo-469440861178/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidate",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "*"
    }
  ]
}
```
CloudFront_S3_Demo
## GitHub Environment Secrets to Add (after terraform apply)

| Secret | `dev` value | `demo` value |
|--------|-------------|--------------|
| `S3_BUCKET_NAME` | `phantomwall-frontend-dev-469440861178` | `phantomwall-frontend-demo-469440861178` |
| `CF_DISTRIBUTION_ID` | (from terraform output `frontend_dev_cf_distribution_id`) | (from terraform output `frontend_demo_cf_distribution_id`) |
