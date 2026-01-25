# PhantomWall Frontend

This is a minimal Vite + React app used as a small console for your PhantomWall instances.

To run locally:

```bash
cd frontend
npm install
npm run dev
```

Deployment to AWS Amplify:
- Create an Amplify app, connect your repo, set the root directory to `frontend` and use the build command `npm run build` and publish directory `dist`.
- Alternatively, use the Amplify CLI to push hosting configuration.

Security note: avoid embedding private keys into the app. Use SSM for shell access and store private keys securely when needed.
