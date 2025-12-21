# Leave Record Management Application

## Overview

A web-based Leave Record Management Application built with React and Express. The system allows organizations to manage employee records, holidays, leave types, and leave requests with role-based access control (Admin and CoAdmin roles). Data persistence is handled through localStorage on the client side, with a PostgreSQL database schema prepared for future backend integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state, React useState/useEffect for local state
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **Build Tool**: Vite with custom plugins for meta images and Replit integration
- **Data Persistence**: Client-side localStorage (see `client/src/lib/storage.ts`)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **Development**: tsx for TypeScript execution, Vite dev server for HMR
- **Production Build**: esbuild for server bundling, Vite for client bundling

### Data Storage Solutions
- **Current**: localStorage-based storage with in-memory fallback (`MemStorage` class in `server/storage.ts`)
- **Prepared**: PostgreSQL with Drizzle ORM (schema defined in `shared/schema.ts`)
- **Schema Management**: Drizzle Kit for migrations (`drizzle.config.ts`)

### Authentication and Authorization
- **Current Implementation**: Simple role-based login stored in localStorage
- **Roles**: Admin (full access) and CoAdmin (limited access)
- **Session**: Client-side session management via `storage.getCurrentUser()`
- **Prepared**: User table schema ready for backend authentication

### Key Design Decisions

**Client-side Data Storage**: The application currently uses localStorage for all data persistence (employees, holidays, leave types, leave requests). This was chosen for simplicity per the original requirements, but the architecture supports migration to the prepared PostgreSQL backend.

**Component Library**: shadcn/ui components provide a consistent, accessible UI foundation. Components are installed in `client/src/components/ui/` and can be customized.

**Monorepo Structure**: 
- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared types and database schema

**Path Aliases**:
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets` → `attached_assets/`

## External Dependencies

### Database
- **PostgreSQL**: Configured via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database toolkit for TypeScript with type-safe queries
- **Drizzle Kit**: CLI for schema migrations (`db:push` command)

### UI Components
- **Radix UI**: Headless component primitives (dialogs, dropdowns, tabs, etc.)
- **Recharts**: Data visualization for analytics dashboard
- **Lucide React**: Icon library
- **date-fns**: Date manipulation utilities

### PDF Generation
- **jsPDF**: Client-side PDF generation for leave reports and summaries

### Development Tools
- **Vite**: Frontend build tool with HMR
- **esbuild**: Fast JavaScript bundler for production server
- **TypeScript**: Type checking across the entire codebase

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Replit integration (dev only)
- `@replit/vite-plugin-dev-banner`: Development banner (dev only)