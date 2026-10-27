# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## No demo fallback mode
The app now requires real Supabase configuration and does not silently load local demo records. Copy `.env.example` to `.env`, fill in your public Supabase URL/key and backend URL, then restart Vite. If your database has no linked patient, the dashboard shows an empty state.

See `DATABASE_AND_SEED_REVIEW.md` for the review of the original comprehensive seed and the remaining backend requirements. For a small development dataset, register and verify one Auth account first, then run `04_demo_seed_one_verified_user.sql` in the Supabase SQL Editor.
