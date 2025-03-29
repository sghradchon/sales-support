# Sales Support App - Dev Guidelines

## Build Commands
- `npm run dev` - Start development server with Vite
- `npm run build` - Build production bundle (runs TypeScript check first)
- `npm run lint` - Run ESLint for all TypeScript/TSX files
- `npm run preview` - Preview production build locally

## Code Style Guidelines

### TypeScript
- Use strict mode with noUnusedLocals and noUnusedParameters
- Prefer explicit typing (interfaces, type annotations) over any/unknown
- Follow camelCase for variables/functions, PascalCase for types/components

### React
- Use functional components with hooks (useState, useEffect, useRef)
- Chakra UI for component styling/layout
- Define component props with explicit interfaces

### Imports/Exports
- Import order: React, external libs, internal modules, styles
- Use named exports for utility functions
- Default exports for React components

### Error Handling
- Use try/catch with specific error types for async operations
- Provide user-friendly error messages via toast notifications
- Use optional chaining and nullish coalescing for safer data access

### AWS Integration
- Amplify client for AWS services
- Handle async operations with proper loading states