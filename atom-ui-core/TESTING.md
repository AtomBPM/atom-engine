# Testing Guide - ATOM UI Core

## Prerequisites

1. **Atom Engine must be running**:
   ```bash
   cd /home/user/project/atom-engine
   ./build/atomd start
   ```

2. **Verify REST API is accessible**:
   ```bash
   curl http://localhost:27555/health
   # Should return: {"success":true,"data":{"status":"healthy",...}}
   ```

3. **Check API key** in config:
   ```bash
   cat /home/user/project/atom-engine/build/config/config.yaml | grep -A 5 "api_keys"
   # Default key: ak_dev_example_AbC123XyZ456
   ```

## Starting ATOM UI Core

### Option 1: Docker (Recommended)
```bash
cd /home/user/project/atom-engine/atom-ui-core
docker-compose up -d --build
```

### Option 2: Local Development
```bash
cd /home/user/project/atom-engine/atom-ui-core
npm install
npm run dev
```

Access UI at: **http://localhost:5173**

## Testing Checklist

### 1. System & Infrastructure ✅

**System Page** (`/system`):
- [ ] System status shows "running"
- [ ] System info displays version and build details
- [ ] Metrics show CPU/Memory/Goroutines
- [ ] Components table displays all components
- [ ] Refresh button updates data

**Storage Page** (`/storage`):
- [ ] Storage status shows "Connected"
- [ ] Storage info displays size and usage
- [ ] Progress bar shows disk usage
- [ ] Statistics are visible

**Daemon Page** (`/daemon`):
- [ ] Daemon status displays
- [ ] Events table shows system events
- [ ] Pagination works

### 2. BPMN Management ✅

**BPMN Page** (`/bpmn`):
- [ ] Upload BPMN file (.bpmn or .xml)
- [ ] Processes table displays uploaded processes
- [ ] View JSON button shows process definition
- [ ] View XML button shows original BPMN
- [ ] Delete button removes process (with confirmation)
- [ ] Statistics show total processes
- [ ] Search filters processes

**Test Files**: Use BPMN files from `/home/user/project/atom-engine/bpmn_test/`

### 3. Process Management ✅

**Processes Page** (`/processes`):
- [ ] Start Process button opens modal
- [ ] Select BPMN process from dropdown
- [ ] Add variables as JSON
- [ ] Process starts successfully
- [ ] Processes table shows all instances
- [ ] Filter by status (active/completed/cancelled)
- [ ] View Info button shows process details
- [ ] View Tokens button shows token table
- [ ] Cancel button stops active process
- [ ] Statistics show counts by status

### 4. Jobs Management ✅

**Jobs Page** (`/jobs`):
- [ ] Activate Jobs button opens form
- [ ] Enter job type and worker name
- [ ] Jobs activate successfully
- [ ] Jobs table displays all jobs
- [ ] Complete button completes job (with variables)
- [ ] Fail button fails job (with retries/error)
- [ ] Throw Error button throws BPMN error
- [ ] Update Retries button changes retries
- [ ] Update Timeout button changes timeout
- [ ] Cancel button cancels job (with confirmation)
- [ ] Statistics display correctly

### 5. Timers Management ✅

**Timers Page** (`/timers`):
- [ ] Create Timer button opens form
- [ ] Enter timer details (ID, duration/cycle)
- [ ] Timer creates successfully
- [ ] Timers table displays all timers
- [ ] Shows remaining seconds
- [ ] Delete button removes timer (with confirmation)
- [ ] Statistics show timer counts by status

### 6. Messages ✅

**Messages Page** (`/messages`):
- [ ] Publish Message button opens form
- [ ] Enter message name and correlation key
- [ ] Message publishes successfully
- [ ] Buffered Messages tab shows buffered messages
- [ ] Subscriptions tab shows active subscriptions
- [ ] Cleanup Expired button removes old messages
- [ ] Test button sends test message
- [ ] Statistics display correctly

### 7. Incidents ✅

**Incidents Page** (`/incidents`):
- [ ] Create Incident button opens form
- [ ] Select incident type and enter details
- [ ] Incident creates successfully
- [ ] Incidents table displays all incidents
- [ ] Filter by state (open/resolved)
- [ ] Resolve button resolves incident
- [ ] Statistics show open vs resolved counts

### 8. Expressions ✅

**Expressions Page** (`/expressions`):
- [ ] Evaluate Expression tab works
- [ ] Enter expression and variables
- [ ] Result displays correctly
- [ ] Evaluate Condition tab works
- [ ] Boolean conditions evaluate
- [ ] Parse Expression shows AST
- [ ] Validate Expression shows validation status
- [ ] Extract Variables shows variable names
- [ ] Supported Functions table displays

### 9. Tokens ✅

**Tokens Page** (`/tokens`):
- [ ] Get Token Status button opens search
- [ ] Enter token ID
- [ ] Token details display
- [ ] Variables show in JSON format

### 10. Dashboard ✅

**Dashboard Page** (`/dashboard`):
- [ ] All statistics load from real APIs
- [ ] System health displays
- [ ] Process counts show correctly
- [ ] Job counts show correctly
- [ ] Timer counts show correctly
- [ ] Message counts show correctly
- [ ] Incident counts show correctly
- [ ] All cards refresh on page load

## Multi-Server Testing

### Test Server Switching:
1. [ ] Configure multiple servers in `.env`
2. [ ] Server selector shows all servers
3. [ ] Switch between servers
4. [ ] Data updates for selected server
5. [ ] API key changes correctly

### Test Authentication:
1. [ ] Invalid API key shows 401 error
2. [ ] Missing API key shows error
3. [ ] Valid API key works
4. [ ] Error toast appears on auth failure

## Error Handling Testing

### Network Errors:
- [ ] Disconnect network - shows error message
- [ ] Invalid URL - shows connection error
- [ ] Timeout - shows timeout error

### API Errors:
- [ ] 400 Bad Request - shows validation error
- [ ] 401 Unauthorized - shows auth error
- [ ] 403 Forbidden - shows permission error
- [ ] 404 Not Found - shows not found error
- [ ] 500 Server Error - shows server error

## Performance Testing

- [ ] All pages load within 2 seconds
- [ ] Tables with 100+ items perform well
- [ ] Modal open/close is smooth
- [ ] No console errors or warnings
- [ ] Hot reload works in development

## UI/UX Testing

### Visual:
- [ ] Dark theme consistent across all pages
- [ ] Colors match Ant Design palette
- [ ] Spacing and alignment correct
- [ ] Icons display properly
- [ ] Tables are readable

### Interactions:
- [ ] All buttons respond to clicks
- [ ] Forms validate inputs
- [ ] Confirmation dialogs show before delete
- [ ] Modals can be closed with X or Cancel
- [ ] Toast notifications appear and disappear

### Responsiveness:
- [ ] Works on desktop (1920x1080)
- [ ] Works on laptop (1366x768)
- [ ] Works on tablet (768px width)
- [ ] Sidebar collapses on mobile
- [ ] Tables scroll horizontally on small screens

## Browser Compatibility

- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Common Issues & Solutions

### Issue: Cannot connect to server
**Solution**: 
1. Check atom-engine is running: `./build/atomd status`
2. Verify REST API port: should be 27555
3. Check Docker network_mode is "host"

### Issue: 401 Unauthorized
**Solution**:
1. Check API key in `.env` matches `config.yaml`
2. Verify auth.enabled is true in config
3. Check X-API-Key header is being sent

### Issue: Empty tables
**Solution**:
1. Create test data using CLI or other endpoints
2. Check API responses in browser DevTools Network tab
3. Verify pagination settings

### Issue: Port 5173 already in use
**Solution**:
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
# Or change port in vite.config.ts
```

## Manual Testing Workflow

### Complete Flow Test:
1. Start atom-engine backend
2. Start ATOM UI Core
3. Upload a BPMN process
4. Start a process instance
5. Monitor process in Processes page
6. Check jobs in Jobs page
7. View system metrics in Dashboard
8. Check incidents if any errors
9. Test expressions evaluation

### Data Flow Test:
1. Upload BPMN → Check in BPMN page
2. Start Process → Check in Processes page
3. Process creates Job → Check in Jobs page
4. Job creates Timer → Check in Timers page
5. Message correlation → Check in Messages page
6. Error occurs → Check in Incidents page

## Automated Testing (Future)

- [ ] Set up Jest + React Testing Library
- [ ] Unit tests for components
- [ ] Integration tests for API calls
- [ ] E2E tests with Playwright
- [ ] CI/CD pipeline

---

**Status**: Manual testing required  
**Prerequisites**: Atom Engine running on localhost:27555  
**Access**: http://localhost:5173
