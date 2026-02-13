# Installation Guide - ATOM UI Core

## Prerequisites

- Docker and Docker Compose (recommended)
- OR Node.js 24+ and npm

## Quick Start with Docker

1. **Navigate to project directory:**
   ```bash
   cd atom-ui-core
   ```

2. **Configure environment** (already done):
   ```bash
   # .env file is already created from .env.example
   # Edit if needed to configure your atom-engine servers
   ```

3. **Build and start:**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the UI:**
   - Open http://localhost:5173 in your browser

5. **View logs:**
   ```bash
   docker-compose logs -f
   ```

6. **Stop:**
   ```bash
   docker-compose down
   ```

## Local Development (without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Access the UI:**
   - Open http://localhost:5173

## Configuration

Edit `.env` file to configure atom-engine servers:

```env
VITE_SERVERS=[
  {
    "id": "prod",
    "name": "Production Server",
    "url": "http://localhost:27555",
    "apiKey": "ak_dev_example_AbC123XyZ456"
  },
  {
    "id": "dev",
    "name": "Development Server",
    "url": "http://localhost:27556",
    "apiKey": "ak_dev_another_key"
  }
]
```

**Important:** Make sure your atom-engine is running on the specified URL (default: http://localhost:27555)

## Network Mode

Docker uses `network_mode: host` to access atom-engine running on the host machine. This means:
- The container shares the host's network stack
- Can access services on localhost:27555 (atom-engine)
- UI will be available on host's port 5173

## Troubleshooting

### Cannot connect to atom-engine

1. Check atom-engine is running:
   ```bash
   # From atom-engine directory
   ./build/atomd status
   ```

2. Verify REST API is accessible:
   ```bash
   curl http://localhost:27555/health
   ```

3. Check API key in .env matches atom-engine configuration

### Port 5173 already in use

Change port in `docker-compose.yml` or `vite.config.ts`

### Permission denied errors

```bash
sudo chown -R $USER:$USER atom-ui-core/
```

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## Features

- ✅ React 19 + TypeScript
- ✅ Ant Design Dark Theme
- ✅ Multi-server support
- ✅ Docker development environment
- ✅ Hot module replacement (HMR)
- ✅ Full REST API integration (84 endpoints)

## Next Steps

1. Configure your atom-engine servers in `.env`
2. Start atom-engine backend
3. Start ATOM UI Core
4. Access http://localhost:5173
5. Select server from dropdown in header
6. Navigate through different modules in sidebar

## Support

- Check ATOM Engine documentation
- Review API documentation in `docs/API/REST_API/`
- Check browser console for errors
