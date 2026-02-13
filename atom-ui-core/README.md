# ATOM UI Core

Admin interface for atom-engine BPMN workflow engine.

## Features

- React 19 + TypeScript
- Ant Design (Dark Theme)
- Full REST API integration (84 endpoints)
- Multi-server support
- Docker development environment

## Quick Start

### Using Docker (Recommended)

1. Copy environment file:
```bash
cp .env.example .env
```

2. Configure your servers in `.env`

3. Start with Docker Compose:
```bash
docker-compose up -d
```

4. Open http://localhost:5173

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Copy and configure `.env`:
```bash
cp .env.example .env
```

3. Start dev server:
```bash
npm run dev
```

## Configuration

Edit `.env` file to configure your atom-engine servers:

```env
VITE_SERVERS=[{"id":"prod","name":"Production","url":"http://localhost:27555","apiKey":"your-api-key"}]
```

## Architecture

- **Frontend**: React 19, TypeScript, Vite
- **UI Framework**: Ant Design (Dark Theme)
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Routing**: React Router v6
- **BPMN Visualization**: bpmn-js

## API Coverage

All 84 REST API endpoints fully implemented:
- System Management (7 + 4 daemon endpoints)
- Storage (2)
- BPMN Parser (7)
- Processes (14)
- Tokens (1)
- Timers (5)
- Jobs (11)
- Messages (6)
- Expressions (8)
- Incidents (5)

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## License

Copyright (c) 2025 Matreska Market LLC
