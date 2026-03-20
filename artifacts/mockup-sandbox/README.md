# Mockup Sandbox

This is a development sandbox used for quickly prototyping and previewing mockup UI designs before implementing them in `library-os` or `admin-portal`.

## Purpose

- Rapid UI prototyping and visual testing
- Component design exploration
- Layout experiments before integration

## Usage

This package is **not deployed** — it is for development purposes only.

```bash
# Run the mockup sandbox dev server
pnpm --filter @workspace/mockup-sandbox run dev
```

## Notes

- Changes here should be migrated to `library-os` or `admin-portal` once finalized
- This sandbox does not connect to the API server
- Designs created here should use shared components from `lib/ui` where possible
