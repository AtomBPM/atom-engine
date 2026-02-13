# BPMN Page Changes Summary

## Изменения от 2026-02-10

### 1. Удалены бесполезные поля статистики
- ❌ Убрано поле "Total Definitions" 
- ❌ Убрано поле "Unique Keys"
- ✅ Оставлено только "Total Processes"

**Файлы:** 
- `src/types/api.ts` - обновлен BPMNStats interface
- `src/pages/Bpmn/BpmnPage.tsx` - убраны карточки статистики

---

### 2. Обновлена таблица BPMN процессов

**Изменен порядок и названия колонок:**
```
PROCESS KEY | PROCESS ID | NAME | VERSION | STATUS | ELEMENTS | CREATED | Actions
```

**Ключевые изменения:**
- Process ID теперь показывается полностью (без усечения `...`)
- Добавлена колонка STATUS с цветными тегами
- Добавлена колонка ELEMENTS с количеством элементов
- CREATED теперь с секундами (YYYY-MM-DD HH:mm:ss)
- Все заголовки заглавными буквами для соответствия CLI

**Файлы:**
- `src/types/api.ts` - добавлены поля element_count и metadata
- `src/pages/Bpmn/BpmnPage.tsx` - обновлены колонки таблицы

---

### 3. Компактная колонка Actions

**Было:** Кнопки с текстом  
**Стало:** Только иконки с подсказками

- Убран текст с кнопок
- Размер кнопок: small
- Стиль: text (более чистый вид)
- Добавлены title атрибуты для подсказок

**Файлы:**
- `src/pages/Bpmn/BpmnPage.tsx` - обновлена колонка Actions

---

### 4. Новая кнопка: API Examples

**Функционал:**
Показывает готовые примеры REST API запросов для каждого BPMN процесса:

1. **Start Process Instance** - запуск с переменными
2. **Get Process Details** - получение информации
3. **Get Process JSON** - JSON представление
4. **Get Process XML** - оригинальный XML
5. **Delete Process** - удаление

**Особенности:**
- Все примеры используют реальные данные (process_key, process_id)
- Формат curl для копирования
- Темная тема модального окна
- Информационный блок с параметрами процесса

**Файлы:**
- `src/pages/Bpmn/BpmnPage.tsx` - добавлена кнопка и модальное окно

---

### 5. Новая кнопка: View Elements

**Функционал:**
Умный анализатор BPMN процесса, показывает:

#### Tasks Configuration
- Task Definition (тип задачи, retries)
- Called Element (для callActivity)
- Task Headers (HTTP параметры)
- IO Mapping (входные/выходные переменные)

#### Timers Configuration
- Duration (например: PT5M - 5 минут)
- Cycle (повторяющиеся таймеры)
- Timer Definition

#### Gateway Conditions
- Condition Expression (проверяемые переменные)

#### Messages Configuration
- Message Definition
- Subscription параметры

**Особенности:**
- Автоматический анализ JSON процесса
- Карточки с цветными тегами для каждого типа
- Темная тема
- Summary с количеством элементов каждого типа

**Файлы:**
- `src/pages/Bpmn/BpmnPage.tsx` - добавлена функция analyzeProcessVariables и модальное окно

---

### 6. Новая функция: BPMN Diagram Visualization

**Реализация:**
- ✅ Отдельная страница `/bpmn/diagram/:processKey`
- ✅ Использует библиотеку bpmn-js v17.11.0
- ✅ Полноэкранный просмотр
- ✅ Навигация через React Router

**Функционал:**
- Zoom (прокрутка мыши)
- Pan (перетаскивание)
- Автоматическое масштабирование
- Кнопка "Back" для возврата
- Информационная панель с деталями процесса

**Файлы:**
- `src/components/BpmnViewer.tsx` - компонент viewer
- `src/pages/Bpmn/BpmnDiagramPage.tsx` - страница визуализации
- `src/routes.tsx` - добавлен маршрут
- `src/pages/Bpmn/BpmnPage.tsx` - кнопка навигации

---

## Итоговый список кнопок в Actions

1. 📊 **Diagram** - открывает отдельную страницу с визуальной диаграммой
2. 🗄️ **Elements** - показывает конфигурацию, параметры и переменные
3. 🔌 **API** - примеры REST API запросов
4. 👁️ **JSON** - структурированные данные
5. 💻 **XML** - исходный BPMN код
6. 🗑️ **Delete** - удаление процесса

---

## Зависимости

Добавлена библиотека:
```json
"bpmn-js": "^17.11.0"
```

Уже была в package.json, но требует установки:
```bash
npm install
```

---

## Docker Development

Проект настроен для разработки в Docker:

```bash
cd atom-ui-core
docker-compose build
docker-compose up
```

Контейнер автоматически:
- Устанавливает зависимости
- Запускает Vite dev server на порту 5173
- Монтирует src и public для hot reload
- Использует host network для доступа к atom-engine

---

## Следующие шаги

1. Пересобрать Docker контейнер:
   ```bash
   docker-compose build
   docker-compose up
   ```

2. Проверить доступность на http://localhost:5173

3. Протестировать все новые функции на странице /bpmn
