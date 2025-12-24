# ARQA - Inventory & Daily Reporting System

A React-based inventory management and daily reporting system for cafés and restaurants. Baristas submit daily stock reports while managers oversee inventory, orders, and analytics.

## Features

- 📊 **Daily Reports** - Baristas submit end-of-day stock counts with automatic write-off calculations
- 📦 **Inventory Management** - Track positions, categories, and stock levels
- 🏭 **Warehouse** - Manage arrivals, costs, and expiry dates with Excel import support
- 🔔 **Notifications** - Automatic alerts for low stock and high write-offs
- 👥 **Role-Based Access** - Separate barista and manager permissions

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth)
- **State**: React Query (@tanstack/react-query)
- **Routing**: React Router v6

## Getting Started

### Prerequisites

- Node.js 18+ and npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Supabase project with configured tables

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd arqa

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file in the project root:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_PROJECT_ID` | Supabase project identifier | `urrfxcmulgycirzqgcma` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anonymous/public key | `eyJhbGciOiJI...` |
| `VITE_SUPABASE_URL` | Supabase API endpoint URL | `https://xxx.supabase.co` |

> **Note**: These are client-side variables prefixed with `VITE_`. Never expose service role keys in frontend code.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── components/       # Reusable UI components
│   └── ui/          # shadcn/ui base components
├── hooks/           # Custom React hooks
├── integrations/    # External service clients (Supabase)
├── lib/             # Utilities
├── pages/           # Route page components
└── services/        # Business logic services
```

## Documentation

- [Architecture Overview](./architecture.md) - System design and data model
