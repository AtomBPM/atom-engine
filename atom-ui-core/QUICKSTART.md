# Быстрый старт - ATOM UI Core

## Минимальные шаги для запуска

### 1. Убедитесь что ATOM Engine запущен

```bash
cd /home/user/project/atom-engine
./build/atomd status
# Должно показать: running
```

Если не запущен:
```bash
./build/atomd start
```

### 2. Проверьте REST API

```bash
curl http://localhost:27555/health
```

Должен вернуть JSON с `"status":"healthy"`

### 3. Настройте конфигурацию UI

```bash
cd /home/user/project/atom-engine/atom-ui-core
cp .env.example .env
```

Отредактируйте `.env`:
```env
# Default server
VITE_API_URL_1=http://localhost:27555
VITE_API_KEY_1=ak_dev_example_AbC123XyZ456
VITE_SERVER_NAME_1=Local Server

# Optional: add more servers
# VITE_API_URL_2=http://remote-server:27555
# VITE_API_KEY_2=your-api-key-here
# VITE_SERVER_NAME_2=Remote Server
```

**Важно**: API ключ должен совпадать с ключом в `/home/user/project/atom-engine/build/config/config.yaml`

### 4. Запустите UI (выберите один вариант)

#### Вариант A: Docker (рекомендуется)

```bash
docker-compose up -d --build
```

#### Вариант B: Локально

```bash
npm install
npm run dev
```

### 5. Откройте в браузере

```
http://localhost:5173
```

## Что дальше?

1. **Dashboard** - посмотрите общую статистику
2. **BPMN** - загрузите BPMN файл из `/home/user/project/atom-engine/bpmn_test/`
3. **Processes** - запустите процесс
4. **System** - проверьте состояние системы

## Частые проблемы

### Проблема: "Cannot connect to server"

**Решение**:
1. Проверьте что atom-engine запущен: `./build/atomd status`
2. Проверьте порт REST API в config: должен быть 27555
3. Если используете Docker, убедитесь что `network_mode: host` в docker-compose.yml

### Проблема: "401 Unauthorized"

**Решение**:
1. Проверьте API ключ в `.env`
2. Сравните с ключом в `build/config/config.yaml`
3. Убедитесь что `auth.enabled: true` в config

### Проблема: "Port 5173 already in use"

**Решение**:
```bash
lsof -ti:5173 | xargs kill -9
```

## Команды Docker

```bash
# Старт
docker-compose up -d

# Перезапуск с rebuild
docker-compose up -d --build

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down

# Полная очистка
docker-compose down -v
```

## Команды npm

```bash
# Установка зависимостей
npm install

# Разработка
npm run dev

# Production build
npm run build

# Preview production
npm run preview

# Линтер
npm run lint
```

---

**Готово!** Теперь вы можете управлять ATOM Engine через веб-интерфейс.
