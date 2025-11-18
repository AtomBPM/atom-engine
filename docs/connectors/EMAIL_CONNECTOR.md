# Email Connector

Email коннектор для Atom Engine - BPMN Process Engine, позволяющий отправлять email сообщения из бизнес-процессов.

## Возможности

- ✅ Отправка email через SMTP
- ✅ Поддержка простой авторизации (username/password)
- ✅ Поддержка различных протоколов шифрования (NONE, TLS, SSL, STARTTLS)
- ✅ HTML и Plain Text форматы
- ✅ Декодирование HTML entities
- ✅ Шаблонизация с переменными процесса `${variable}`
- ✅ Поддержка CC и BCC получателей
- ✅ Кастомные заголовки
- ✅ Поддержка вложений (attachments)

## Тип коннектора

```
Type: io.camunda:email:1
Template: io.camunda.connectors.email.v1
```

## Конфигурационные параметры

### Аутентификация

| Параметр | Путь | Тип | Обязательный | Описание |
|----------|------|-----|--------------|----------|
| Authentication Type | `authentication.type` | string | Да | Тип авторизации: `simple` |
| Username | `authentication.username` | string | Да | SMTP логин / email |
| Password | `authentication.password` | string | Да | SMTP пароль |

### SMTP конфигурация

| Параметр | Путь | Тип | Обязательный | Описание |
|----------|------|-----|--------------|----------|
| Protocol | `protocol` | string | Да | Протокол: `smtp` |
| SMTP Host | `data.smtpConfig.smtpHost` | string | Да | Адрес SMTP сервера |
| SMTP Port | `data.smtpConfig.smtpPort` | integer | Да | Порт SMTP сервера (25, 465, 587) |
| Cryptographic Protocol | `data.smtpConfig.smtpCryptographicProtocol` | string | Да | Протокол шифрования: `NONE`, `TLS`, `SSL`, `STARTTLS` |

### Email данные

| Параметр | Путь | Тип | Обязательный | Описание |
|----------|------|-----|--------------|----------|
| From | `data.smtpAction.from` | string | Да | Адрес отправителя |
| To | `data.smtpAction.to` | string | Да | Адрес получателя (можно несколько через запятую) |
| CC | `data.smtpAction.cc` | string | Нет | Копия (можно несколько через запятую) |
| BCC | `data.smtpAction.bcc` | string | Нет | Скрытая копия (можно несколько через запятую) |
| Subject | `data.smtpAction.subject` | string | Да | Тема письма |
| Content Type | `data.smtpAction.contentType` | string | Да | Тип контента: `PLAIN` или `HTML` |
| Body | `data.smtpAction.body` | string | Да* | Тело письма (Plain Text) |
| HTML Body | `data.smtpAction.htmlBody` | string | Да* | Тело письма (HTML) |

\* Используйте либо `body` для Plain Text, либо `htmlBody` для HTML контента

## Протоколы шифрования

### NONE (порт 25)
Без шифрования. Используется для локальных серверов или тестирования.

```xml
<zeebe:input source="=25" target="data.smtpConfig.smtpPort" />
<zeebe:input source="NONE" target="data.smtpConfig.smtpCryptographicProtocol" />
```

### TLS/SSL (порт 465)
Полное TLS/SSL шифрование соединения.

```xml
<zeebe:input source="=465" target="data.smtpConfig.smtpPort" />
<zeebe:input source="SSL" target="data.smtpConfig.smtpCryptographicProtocol" />
```

### STARTTLS (порт 587)
Начинается как незащищенное соединение, затем обновляется до TLS.

```xml
<zeebe:input source="=587" target="data.smtpConfig.smtpPort" />
<zeebe:input source="STARTTLS" target="data.smtpConfig.smtpCryptographicProtocol" />
```

## Работа с переменными

Email коннектор поддерживает два способа работы с переменными процесса:

### 1. Прямая подстановка переменной

Используйте префикс `=` для указания имени переменной:

```xml
<zeebe:input source="=emailBody" target="data.smtpAction.htmlBody" />
```

В процессе:
```json
{
  "emailBody": "<h1>Привет!</h1>"
}
```

### 2. Шаблонизация с `${variable}`

Используйте синтаксис `${variable}` внутри текста для подстановки значений:

```xml
<zeebe:input source="=emailTemplate" target="data.smtpAction.htmlBody" />
```

В процессе:
```json
{
  "emailTemplate": "<h1>Привет, ${userName}!</h1><p>Ваш заказ #${orderNumber}</p>",
  "userName": "Иван Иванов",
  "orderNumber": "12345"
}
```

Результат:
```html
<h1>Привет, Иван Иванов!</h1>
<p>Ваш заказ #12345</p>
```

## Примеры BPMN

### Пример 1: Простое текстовое письмо

```xml
<bpmn:serviceTask id="Activity_Email" name="Send Email" 
                  zeebe:modelerTemplate="io.camunda.connectors.email.v1">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="io.camunda:email:1" retries="3" />
    <zeebe:ioMapping>
      <zeebe:input source="simple" target="authentication.type" />
      <zeebe:input source="sender@example.com" target="authentication.username" />
      <zeebe:input source="password123" target="authentication.password" />
      <zeebe:input source="smtp" target="protocol" />
      <zeebe:input source="smtp.example.com" target="data.smtpConfig.smtpHost" />
      <zeebe:input source="=587" target="data.smtpConfig.smtpPort" />
      <zeebe:input source="STARTTLS" target="data.smtpConfig.smtpCryptographicProtocol" />
      <zeebe:input source="sendEmailSmtp" target="data.smtpActionDiscriminator" />
      <zeebe:input source="sender@example.com" target="data.smtpAction.from" />
      <zeebe:input source="recipient@example.com" target="data.smtpAction.to" />
      <zeebe:input source="Test Subject" target="data.smtpAction.subject" />
      <zeebe:input source="PLAIN" target="data.smtpAction.contentType" />
      <zeebe:input source="Hello World!" target="data.smtpAction.body" />
    </zeebe:ioMapping>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

### Пример 2: HTML письмо с переменными

```xml
<bpmn:serviceTask id="Activity_Email" name="Send HTML Email" 
                  zeebe:modelerTemplate="io.camunda.connectors.email.v1">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="io.camunda:email:1" retries="3" />
    <zeebe:ioMapping>
      <zeebe:input source="simple" target="authentication.type" />
      <zeebe:input source="sender@example.com" target="authentication.username" />
      <zeebe:input source="password123" target="authentication.password" />
      <zeebe:input source="smtp" target="protocol" />
      <zeebe:input source="smtp.gmail.com" target="data.smtpConfig.smtpHost" />
      <zeebe:input source="=465" target="data.smtpConfig.smtpPort" />
      <zeebe:input source="SSL" target="data.smtpConfig.smtpCryptographicProtocol" />
      <zeebe:input source="sendEmailSmtp" target="data.smtpActionDiscriminator" />
      <zeebe:input source="sender@example.com" target="data.smtpAction.from" />
      <zeebe:input source="recipient@example.com" target="data.smtpAction.to" />
      <zeebe:input source="Order Confirmation" target="data.smtpAction.subject" />
      <zeebe:input source="HTML" target="data.smtpAction.contentType" />
      <zeebe:input source="=htmlTemplate" target="data.smtpAction.htmlBody" />
    </zeebe:ioMapping>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

При запуске процесса:
```bash
atomd process start MyProcess -d '{
  "htmlTemplate": "<h1>Заказ #${orderNumber}</h1><p>Клиент: ${customerName}</p>",
  "orderNumber": "ORD-12345",
  "customerName": "Иван Иванов"
}'
```

### Пример 3: Письмо с CC и BCC

```xml
<zeebe:ioMapping>
  <zeebe:input source="sender@example.com" target="data.smtpAction.from" />
  <zeebe:input source="recipient@example.com" target="data.smtpAction.to" />
  <zeebe:input source="cc1@example.com, cc2@example.com" target="data.smtpAction.cc" />
  <zeebe:input source="bcc@example.com" target="data.smtpAction.bcc" />
  <zeebe:input source="Important Notice" target="data.smtpAction.subject" />
  <zeebe:input source="PLAIN" target="data.smtpAction.contentType" />
  <zeebe:input source="This is important message" target="data.smtpAction.body" />
</zeebe:ioMapping>
```

## Запуск процесса с переменными

### CLI команда

```bash
# Простой текст
atomd process start ProcessId -d '{"message":"Hello World"}'

# HTML шаблон
atomd process start ProcessId -d '{
  "emailBody": "<h1>Привет, ${name}!</h1>",
  "name": "Иван"
}'

# Сложный HTML
atomd process start ProcessId -d '{
  "emailTemplate": "<html><body><h1>${title}</h1><p>${content}</p></body></html>",
  "title": "Уведомление",
  "content": "Ваш заказ обработан"
}'
```

### REST API

```bash
curl -X POST http://localhost:27555/api/v1/process/start \
  -H "Content-Type: application/json" \
  -d '{
    "processKey": "ProcessId",
    "variables": {
      "emailBody": "<h1>Hello ${userName}</h1>",
      "userName": "John Doe"
    }
  }'
```

## Ответ коннектора

После успешной отправки email коннектор добавляет в переменные процесса объект `response`:

```json
{
  "response": {
    "status": "success",
    "messageId": "<1763436004067417359@mail.nocobase.ru>",
    "timestamp": "2025-11-18T06:20:04+03:00"
  }
}
```

Эти данные можно использовать в последующих шагах процесса.

## Обработка ошибок

При возникновении ошибки коннектор:
1. Логирует ошибку
2. Возвращает `Success: false`
3. Устанавливает описание ошибки в `Error` поле

Если в `zeebe:taskDefinition` указан параметр `retries`, коннектор будет повторять попытки отправки.

```xml
<zeebe:taskDefinition type="io.camunda:email:1" retries="3" />
<zeebe:taskHeaders>
  <zeebe:header key="retryBackoff" value="PT5S" />
</zeebe:taskHeaders>
```

## Типичные проблемы

### 1. Ошибка "unencrypted connection"

**Причина:** Используется `NONE` протокол без поддержки незашифрованного соединения.

**Решение:** Используйте правильную комбинацию порта и протокола:
- Порт 25 + NONE (для локальных серверов)
- Порт 465 + SSL/TLS
- Порт 587 + STARTTLS

### 2. Ошибка "certificate verification failed"

**Причина:** Проблема с SSL сертификатом сервера.

**Решение:** 
- Проверьте правильность адреса SMTP сервера
- Для локальных серверов используйте NONE протокол на порту 25

### 3. Пустое письмо при отправке HTML

**Причина:** HTML entities не декодированы или переменная не разрешена.

**Решение:**
- Убедитесь что используете `source="=variableName"` для переменных
- Проверьте что переменная передана в процесс
- Используйте синтаксис `${variable}` для подстановки

### 4. Переменные не подставляются

**Причина:** Неправильный синтаксис или переменная отсутствует.

**Решение:**
- Используйте точный синтаксис: `${variableName}`
- Проверьте что переменная передана в процесс
- Переменные регистрозависимы

## Примеры использования

### Уведомление о заказе

```json
{
  "emailTemplate": "<!DOCTYPE html><html><body><h1>Заказ #${orderNumber}</h1><p>Уважаемый ${customerName}!</p><p>Ваш заказ на сумму <strong>${totalAmount} руб.</strong> принят в обработку.</p><p>Статус: ${orderStatus}</p><p>Дата доставки: ${deliveryDate}</p></body></html>",
  "orderNumber": "ORD-2025-001",
  "customerName": "Иван Петров",
  "totalAmount": "15000",
  "orderStatus": "В обработке",
  "deliveryDate": "25.11.2025"
}
```

### Напоминание о встрече

```json
{
  "emailTemplate": "<html><body><h2>Напоминание о встрече</h2><p>Здравствуйте, ${participantName}!</p><p>Напоминаем о встрече:</p><ul><li>Тема: ${meetingTopic}</li><li>Дата: ${meetingDate}</li><li>Время: ${meetingTime}</li><li>Место: ${meetingLocation}</li></ul><p>До встречи!</p></body></html>",
  "participantName": "Анна Сидорова",
  "meetingTopic": "Обсуждение проекта",
  "meetingDate": "20.11.2025",
  "meetingTime": "14:00",
  "meetingLocation": "Офис, переговорная 3"
}
```

### Отчет о выполнении

```json
{
  "emailTemplate": "<html><body><h1>Отчет: ${reportTitle}</h1><p>Период: ${reportPeriod}</p><table border='1'><tr><th>Показатель</th><th>Значение</th></tr><tr><td>Продажи</td><td>${salesAmount}</td></tr><tr><td>Новые клиенты</td><td>${newCustomers}</td></tr><tr><td>Прибыль</td><td>${profit}</td></tr></table></body></html>",
  "reportTitle": "Ежемесячный отчет",
  "reportPeriod": "Октябрь 2025",
  "salesAmount": "2 500 000 руб",
  "newCustomers": "45",
  "profit": "850 000 руб"
}
```

## Совместимость

Email коннектор полностью совместим с Camunda 8 синтаксисом:
- Используется стандартная нотация `io.camunda:email:1`
- Поддерживается синтаксис `${variable}` как в Camunda
- Совместим с Camunda Modeler шаблонами

## Логирование

Коннектор логирует следующие события:
- **INFO** - Начало выполнения, успешная отправка
- **ERROR** - Ошибки конфигурации, ошибки отправки
- **DEBUG** - Детали конфигурации (только при debug уровне)

Пример логов:
```
[INFO ] Executing email connector | token_id=atom-xxx element_id=Activity_Email
[INFO ] Email connector configuration extracted | token_id=atom-xxx to=recipient@example.com subject=Test
[INFO ] Email sent successfully | token_id=atom-xxx to=recipient@example.com message_id=<xxx@example.com>
```

## См. также

- [Atom Engine CLI Commands](../CLI_COMMANDS.md)
- [Process Management](../PROCESS_MANAGEMENT.md)
- [Variables and Expressions](../VARIABLES_AND_EXPRESSIONS.md)

