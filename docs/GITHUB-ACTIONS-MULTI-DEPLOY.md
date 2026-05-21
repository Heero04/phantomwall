# GitHub Actions Multi-Deployment Setup

This workflow deploys two environments from two branches:

- `Dev` -> `dev` environment
- `demo/org-onboarding` -> `demo` environment

Workflow file: `.github/workflows/deploy-multi-env.yml`

## 1) Create GitHub Environments

In your repo:

1. Go to `Settings -> Environments`
2. Create:
   - `dev`
   - `demo`

You can optionally require manual approval in `demo`.

## 2) Add Environment Variables and Secrets

Set these for **both** environments unless noted.

### Environment Variables (`vars`)

- `AWS_REGION` (example: `us-east-1`)
- `AMPLIFY_BRANCH` (example: `Dev` for dev env, `demo/org-onboarding` for demo env)
- `VITE_AWS_REGION` (same as AWS region)
- `VITE_USE_MOCK_AUTH` (`false` for real auth, `true` for mock)

### Environment Secrets (`secrets`)

- `AWS_ROLE_ARN` (OIDC deploy role for that environment)
- `AMPLIFY_APP_ID` (Amplify app id for that environment)
- `VITE_COGNITO_USER_POOL_ID` (Cognito user pool id)
- `VITE_COGNITO_CLIENT_ID` (Cognito app client id)

## 3) Configure OIDC IAM Role Trust Policy

Each `AWS_ROLE_ARN` should trust GitHub OIDC and limit to this repo.

Minimum shape:

- OIDC provider: `token.actions.githubusercontent.com`
- Audience condition: `sts.amazonaws.com`
- Subject condition scoped to your repository

Example subject patterns:

- `repo:Heero04/phantomwall:*`

You can further restrict by branch or environment name.

## 4) Deploy Flow

- Push to `Dev` branch -> workflow uses GitHub environment `dev`
- Push to `demo/org-onboarding` branch -> workflow uses GitHub environment `demo`
- Manual run is also available via `workflow_dispatch`

## 5) Notes

- This workflow builds the frontend and then triggers an Amplify `RELEASE` job.
- It does not run Terraform apply yet.
- If you want Terraform per environment next, add a second workflow with remote state and env-specific tfvars.
