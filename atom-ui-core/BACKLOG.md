# Бэклог - ATOM UI Core

## Выполнено ✅

### Инфраструктура
- [x] Docker + Docker Compose с network_mode: host
- [x] React 19 + TypeScript + Vite
- [x] Ant Design 5 с темной темой
- [x] React Router v6
- [x] Zustand для state management
- [x] Axios client с interceptors
- [x] Layout (Header, Sidebar, Content)
- [x] Роутинг для всех страниц
- [x] Multi-server поддержка
- [x] API Key авторизация
- [x] Error handling с toast notifications

### API Endpoints (84/84)
- [x] Health (1)
- [x] System (7)
- [x] Storage (2)
- [x] Daemon (4)
- [x] BPMN Parser (7)
- [x] Processes (14)
- [x] Tokens (1)
- [x] Timers (5)
- [x] Jobs (11)
- [x] Messages (6)
- [x] Expressions (8)
- [x] Incidents (5)

### UI Страницы (12/12)
- [x] Dashboard с реальной статистикой
- [x] System - мониторинг системы
- [x] Storage - состояние хранилища
- [x] Daemon - статус демона
- [x] BPMN - загрузка и управление
- [x] Processes - полное управление процессами
- [x] Jobs - все операции с заданиями
- [x] Timers - управление таймерами
- [x] Messages - публикация и подписки
- [x] Incidents - создание и разрешение
- [x] Expressions - оценка и валидация
- [x] Tokens - статус токенов

### Документация
- [x] README.md - общее описание
- [x] INSTALL.md - детальная установка
- [x] QUICKSTART.md - быстрый старт
- [x] PROGRESS.md - детальный прогресс
- [x] API_COVERAGE.md - покрытие API
- [x] TESTING.md - тестирование
- [x] SUMMARY.md - краткий отчет
- [x] BACKLOG.md - этот файл

## Не реализовано (низкий приоритет)

### Визуализация
- [ ] BPMN диаграммы с bpmn-js (библиотека подключена)
- [ ] Граф трассировки токенов
- [ ] Графики метрик системы
- [ ] Визуализация процесса выполнения

### Тестирование
- [ ] Unit тесты (Jest + RTL)
- [ ] Integration тесты
- [ ] E2E тесты (Playwright)
- [ ] Snapshot тесты

### Production
- [ ] Оптимизация bundle size
- [ ] Code splitting
- [ ] Service Worker / PWA
- [ ] Nginx конфигурация
- [ ] CI/CD pipeline

### Дополнительно
- [ ] Интернационализация (i18n)
- [ ] Экспорт данных (CSV/JSON)
- [ ] Импорт процессов batch
- [ ] Настройки пользователя
- [ ] Темная/светлая тема переключатель
- [ ] Горячие клавиши
- [ ] Уведомления WebSocket
- [ ] Real-time обновления

## Возможные улучшения

### UX
- [ ] Автосохранение форм
- [ ] История действий (undo/redo)
- [ ] Drag & drop для BPMN
- [ ] Контекстные меню
- [ ] Tooltips с подсказками
- [ ] Guided tour для новых пользователей

### Функциональность
- [ ] Поиск по всем модулям
- [ ] Фильтры и сохраненные представления
- [ ] Bulk операции (выбор нескольких элементов)
- [ ] Расширенная фильтрация
- [ ] Сортировка по всем полям
- [ ] Экспорт отчетов

### Безопасность
- [ ] OAuth2 / JWT авторизация
- [ ] Role-based access control (RBAC)
- [ ] Audit log
- [ ] Session management
- [ ] Rate limiting на клиенте
- [ ] CSP headers

### Мониторинг
- [ ] Client-side error tracking (Sentry)
- [ ] Analytics (Plausible/Matomo)
- [ ] Performance monitoring
- [ ] User behavior tracking

## Технический долг

- [ ] Оптимизация re-renders
- [ ] Мемоизация компонентов
- [ ] Виртуализация длинных списков
- [ ] Debounce для поисков
- [ ] Lazy loading изображений
- [ ] Оптимизация запросов (batch, cache)

## Баги / Issues

На данный момент нет известных багов. После тестирования с реальным backend будет видно.

---

**Статус**: Готов к тестированию  
**Приоритет**: Сначала протестировать с реальным atom-engine  
**Следующий шаг**: См. TESTING.md
