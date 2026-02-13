# BPMN Navigation Fix

## Проблемы которые были исправлены

### 1. Скролл прокручивал страницу браузера вместо зума
**Проблема:** При прокрутке колесиком мыши на диаграмме, скроллилась основная страница браузера.

**Решение:**
- Добавлен `preventDefault()` на wheel событие
- Используется `{ passive: false }` для возможности предотвращения события
- Добавлен `stopPropagation()` на React обработчике

```typescript
const preventScroll = (e: WheelEvent) => {
  e.preventDefault()
  e.stopPropagation()
}
container.addEventListener('wheel', preventScroll, { passive: false })
```

### 2. Перетаскивание не работало
**Проблема:** Невозможно было перетаскивать диаграмму мышью.

**Решение:**
- Включен модуль `zoomScroll` в bpmn-js viewer
- Добавлены визуальные индикаторы (cursor: grab/grabbing)
- Встроенный модуль `moveCanvas` в bpmn-js Viewer включен по умолчанию

```typescript
// Enable mouse wheel zoom
const zoomScroll = viewer.get('zoomScroll')
zoomScroll.toggle(true)

// Visual feedback for dragging
const handleMouseDown = (e: MouseEvent) => {
  if (e.button === 0) {
    isDragging = true
    djsContainer.style.cursor = 'grabbing'
  }
}
```

## Что теперь работает

### ✅ Масштабирование колесиком мыши
- **Scroll Up** (прокрутка вверх) - увеличение
- **Scroll Down** (прокрутка вниз) - уменьшение
- Плавное масштабирование с отображением уровня zoom в %

### ✅ Перетаскивание диаграммы
- **Зажать левую кнопку мыши** - начать перетаскивание
- **Перемещать мышь** - двигать диаграмму
- **Отпустить кнопку** - завершить перетаскивание
- Курсор меняется: `grab` → `grabbing` → `grab`

### ✅ Кнопки управления
- **Zoom In** (+) - пошаговое увеличение
- **Zoom Out** (-) - пошаговое уменьшение
- **Fit to Screen** - подогнать под размер экрана
- **Reset View** - вернуть к 100% и центрировать

### ✅ Подсказки на экране
Внизу слева отображаются инструкции:
- 🖱️ Scroll to zoom
- ✋ Drag to pan

## Технические детали

### CSS стили
Добавлены глобальные стили для правильного отображения курсора:

```css
.djs-container {
  cursor: grab !important;
}
.djs-container:active {
  cursor: grabbing !important;
}
.djs-overlay-container {
  pointer-events: none;
}
```

### Контейнер настройки
```css
overflow: hidden;
position: relative;
```

Это предотвращает скролл контейнера и правильно позиционирует элементы управления.

### Event Listeners
Все обработчики событий правильно удаляются при размонтировании компонента:

```typescript
return () => {
  container.removeEventListener('wheel', preventScroll)
  container.removeEventListener('mousedown', handleMouseDown)
  container.removeEventListener('mouseup', handleMouseUp)
  container.removeEventListener('mouseleave', handleMouseLeave)
  document.removeEventListener('mouseup', handleMouseUp)
}
```

## Как использовать

1. Откройте страницу с BPMN диаграммой
2. Наведите курсор на диаграмму
3. Используйте:
   - **Колесико мыши** для zoom
   - **Левая кнопка + перетаскивание** для навигации
   - **Кнопки** в правом верхнем углу для точного управления

## Совместимость

Работает во всех современных браузерах:
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Opera

## Примечания

- Скролл страницы блокируется только когда курсор находится над диаграммой
- После выхода курсора за пределы диаграммы, обычный скролл страницы восстанавливается
- Перетаскивание работает только левой кнопкой мыши
- Средняя кнопка мыши (колесико) используется для скролла/zoom
