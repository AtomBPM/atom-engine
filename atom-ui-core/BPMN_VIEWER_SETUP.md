# BPMN Viewer Setup

## Что добавлено

Добавлена визуализация BPMN диаграмм с использованием библиотеки bpmn-js.

### Новые компоненты и страницы:
- **Отдельная страница** для просмотра диаграмм (`/bpmn/diagram/:processKey`)
- Кнопка навигации на страницу диаграммы
- Полноэкранный просмотр процесса

## Установка зависимостей

### Для Docker окружения:

Зависимость `bpmn-js` уже указана в `package.json`. Если вы используете Docker, убедитесь что контейнер пересобран:

```bash
cd atom-ui-core
docker-compose build
docker-compose up
```

### Для локальной разработки:

```bash
cd atom-ui-core
npm install
npm run dev
```

## Использование

1. На странице BPMN Parser (`/bpmn`) найдите процесс
2. Нажмите на иконку диаграммы (первая кнопка в колонке Actions)
3. Откроется отдельная страница `/bpmn/diagram/:processKey` с визуализацией
4. На странице диаграммы:
   - Zoom (прокрутка мыши)
   - Pan (перетаскивание)
   - Автоматическое масштабирование при загрузке
   - Кнопка "Back" для возврата к списку

## Структура файлов

- `src/components/BpmnViewer.tsx` - компонент для отображения BPMN диаграмм
- `src/pages/Bpmn/BpmnPage.tsx` - список процессов с кнопкой навигации
- `src/pages/Bpmn/BpmnDiagramPage.tsx` - отдельная страница визуализации
- `src/routes.tsx` - добавлен маршрут `/bpmn/diagram/:processKey`

## Технические детали

Используется библиотека `bpmn-js` версии 17.11.0:
- Легковесный viewer (без редактирования)
- Поддержка BPMN 2.0
- Автоматическое масштабирование
- Минимальные стили для интеграции с Ant Design
- React Router для навигации

## Маршруты

```typescript
// Список процессов
/bpmn

// Визуализация конкретного процесса
/bpmn/diagram/:processKey
```

## CSS стили

Компонент автоматически импортирует необходимые стили:
```typescript
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
```

Эти стили обеспечивают правильное отображение элементов диаграммы и шрифтов BPMN.

## Docker Compose пример

Если у вас еще нет docker-compose.yml для frontend:

```yaml
version: '3.8'
services:
  atom-ui:
    build: .
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm run dev
```
