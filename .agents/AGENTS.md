# Project-Wide Engineering Rules - AgriNexus AI

These guidelines govern the development, libraries, styles, and workflow of AgriNexus AI.

## Technology Requirements & Versioning
* Always utilize the latest stable production releases of every framework, library, SDK, and tool.
* No deprecated APIs, legacy patterns, or outdated packages should be introduced.
* Verify the latest stable documentation and APIs before implementation.

## Code Quality & Architecture
* Follow Clean Architecture and SOLID principles.
* Maintain modular, reusable components and clean folder layouts.
* Add meaningful comments only where they improve understanding.

## Security
* Validate all inputs.
* Never expose secrets.
* Implement robust JWT-based authorization and role checks.
* Handle errors gracefully without exposing sensitive system properties.

## Performance
* Optimize rendering. Correctly partition client/server components in Next.js.
* Write highly scalable code.

## UI/UX Design System
* Maintain a premium Apple-inspired glassmorphic design system.
* Ensure responsive mobile-first layouts.
* Implement custom loading skeletons, empty/error states, and smooth keyframe micro-animations.

## Workflow & Documentation
* Fully test features. Keep frontend, backend, database, and APIs aligned.
* Document any new packages, setup instructions, or migrations.
