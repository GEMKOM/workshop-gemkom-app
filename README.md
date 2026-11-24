# GEMKOM Saha

The workshop app at [saha.gemcore.com.tr](https://saha.gemcore.com.tr), used by operators on their phones: machining, CNC cutting, welding timesheets, maintenance and department requests.

The app is in [`web/`](web/): Vite, React, TypeScript, Mantine and TanStack Query.

```sh
cd web
npm install
npm run dev        # http://localhost:5190
npm run test
npm run build
```

- CI (`.github/workflows/ci.yml`) checks every pull request: types, lint, formatting, tests and the build.
- Every push to `main` is deployed to GitHub Pages by `.github/workflows/deploy.yml`.
- `CNAME` holds the custom domain.
