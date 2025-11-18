# Email Connector Examples

Примеры использования Email коннектора в Atom Engine.

## Примеры

### 1. email_simple.bpmn
Простой пример отправки текстового письма.

**Запуск:**
```bash
atomd bpmn parse docs/connectors/examples/email_simple.bpmn
atomd process start Process_EmailSimple
```

**Что демонстрирует:**
- Базовая конфигурация SMTP
- Простое текстовое письмо
- STARTTLS шифрование на порту 587

---

### 2. email_html_variables.bpmn
Продвинутый пример с HTML и переменными.

**Запуск:**
```bash
atomd bpmn parse docs/connectors/examples/email_html_variables.bpmn

atomd process start Process_EmailHTML -d '{
  "emailTemplate": "<html><body><h1>Заказ #${orderNumber}</h1><p>Уважаемый ${customerName}!</p><p>Ваш заказ на сумму <strong>${totalAmount} руб.</strong> принят.</p><p>Статус: <em>${orderStatus}</em></p><ul><li>Товар: ${productName}</li><li>Количество: ${quantity}</li><li>Дата доставки: ${deliveryDate}</li></ul><p>С уважением,<br>${companyName}</p></body></html>",
  "orderNumber": "ORD-2025-001",
  "customerName": "Иван Петров",
  "totalAmount": "15000",
  "orderStatus": "В обработке",
  "productName": "Ноутбук ASUS",
  "quantity": "1",
  "deliveryDate": "25.11.2025",
  "companyName": "Atom Shop"
}'
```

**Что демонстрирует:**
- HTML письмо с форматированием
- Шаблонизация с переменными `${variable}`
- Динамическая тема письма
- SSL шифрование на порту 465

**Результат письма:**
```html
<html>
<body>
  <h1>Заказ #ORD-2025-001</h1>
  <p>Уважаемый Иван Петров!</p>
  <p>Ваш заказ на сумму <strong>15000 руб.</strong> принят.</p>
  <p>Статус: <em>В обработке</em></p>
  <ul>
    <li>Товар: Ноутбук ASUS</li>
    <li>Количество: 1</li>
    <li>Дата доставки: 25.11.2025</li>
  </ul>
  <p>С уважением,<br>Atom Shop</p>
</body>
</html>
```

---

## Настройка для ваших нужд

### Изменение SMTP настроек

Отредактируйте секцию SMTP Configuration в BPMN файле:

```xml
<!-- Для Gmail -->
<zeebe:input source="smtp.gmail.com" target="data.smtpConfig.smtpHost" />
<zeebe:input source="=587" target="data.smtpConfig.smtpPort" />
<zeebe:input source="STARTTLS" target="data.smtpConfig.smtpCryptographicProtocol" />

<!-- Для Yandex -->
<zeebe:input source="smtp.yandex.ru" target="data.smtpConfig.smtpHost" />
<zeebe:input source="=465" target="data.smtpConfig.smtpPort" />
<zeebe:input source="SSL" target="data.smtpConfig.smtpCryptographicProtocol" />

<!-- Для Mail.ru -->
<zeebe:input source="smtp.mail.ru" target="data.smtpConfig.smtpHost" />
<zeebe:input source="=465" target="data.smtpConfig.smtpPort" />
<zeebe:input source="SSL" target="data.smtpConfig.smtpCryptographicProtocol" />

<!-- Локальный сервер без шифрования -->
<zeebe:input source="localhost" target="data.smtpConfig.smtpHost" />
<zeebe:input source="=25" target="data.smtpConfig.smtpPort" />
<zeebe:input source="NONE" target="data.smtpConfig.smtpCryptographicProtocol" />
```

### Добавление CC и BCC

```xml
<zeebe:input source="cc@example.com" target="data.smtpAction.cc" />
<zeebe:input source="bcc1@example.com, bcc2@example.com" target="data.smtpAction.bcc" />
```

### Использование переменных для получателей

```xml
<zeebe:input source="=recipientEmail" target="data.smtpAction.to" />
```

Передайте при запуске:
```bash
atomd process start ProcessId -d '{"recipientEmail":"user@example.com"}'
```

---

## Шаблоны HTML писем

### Уведомление о регистрации

```json
{
  "emailTemplate": "<!DOCTYPE html><html><head><style>body { font-family: Arial, sans-serif; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #4CAF50; color: white; padding: 20px; text-align: center; } .content { padding: 20px; background: #f9f9f9; } .button { background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; display: inline-block; border-radius: 5px; }</style></head><body><div class='container'><div class='header'><h1>Добро пожаловать!</h1></div><div class='content'><p>Здравствуйте, ${userName}!</p><p>Спасибо за регистрацию на ${siteName}.</p><p>Ваш email: <strong>${userEmail}</strong></p><p><a href='${activationLink}' class='button'>Активировать аккаунт</a></p></div></div></body></html>",
  "userName": "Иван",
  "siteName": "Atom Platform",
  "userEmail": "ivan@example.com",
  "activationLink": "https://example.com/activate?token=abc123"
}
```

### Подтверждение оплаты

```json
{
  "emailTemplate": "<!DOCTYPE html><html><body style='font-family: Arial, sans-serif;'><div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;'><h2 style='color: #2196F3;'>Оплата получена</h2><p>Здравствуйте, ${customerName}!</p><p>Ваш платеж успешно обработан.</p><table style='width: 100%; border-collapse: collapse; margin: 20px 0;'><tr><td style='padding: 10px; border-bottom: 1px solid #ddd;'><strong>Номер транзакции:</strong></td><td style='padding: 10px; border-bottom: 1px solid #ddd;'>${transactionId}</td></tr><tr><td style='padding: 10px; border-bottom: 1px solid #ddd;'><strong>Сумма:</strong></td><td style='padding: 10px; border-bottom: 1px solid #ddd;'>${amount} руб.</td></tr><tr><td style='padding: 10px; border-bottom: 1px solid #ddd;'><strong>Дата:</strong></td><td style='padding: 10px; border-bottom: 1px solid #ddd;'>${paymentDate}</td></tr></table><p>Спасибо за покупку!</p></div></body></html>",
  "customerName": "Мария Иванова",
  "transactionId": "TXN-987654",
  "amount": "2500",
  "paymentDate": "18.11.2025 15:30"
}
```

### Напоминание о событии

```json
{
  "emailTemplate": "<!DOCTYPE html><html><body style='font-family: Arial;'><div style='max-width: 600px; margin: 20px auto; padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;'><h1 style='margin: 0 0 20px 0;'>📅 Напоминание</h1><div style='background: rgba(255,255,255,0.9); color: #333; padding: 20px; border-radius: 5px;'><h2 style='margin-top: 0;'>${eventTitle}</h2><p><strong>Дата:</strong> ${eventDate}</p><p><strong>Время:</strong> ${eventTime}</p><p><strong>Место:</strong> ${eventLocation}</p><p>${eventDescription}</p></div><p style='margin-top: 20px; font-size: 14px; text-align: center;'>До встречи, ${organizerName}</p></div></body></html>",
  "eventTitle": "Встреча команды",
  "eventDate": "22.11.2025",
  "eventTime": "10:00",
  "eventLocation": "Офис, переговорная 2",
  "eventDescription": "Обсуждение планов на следующий квартал",
  "organizerName": "Команда Atom"
}
```

---

## REST API примеры

### Отправка через REST API

```bash
curl -X POST http://localhost:27555/api/v1/process/start \
  -H "Content-Type: application/json" \
  -d '{
    "processKey": "Process_EmailHTML",
    "variables": {
      "emailTemplate": "<h1>Hello ${name}</h1>",
      "name": "World",
      "orderNumber": "123"
    }
  }'
```

### Проверка статуса

```bash
curl http://localhost:27555/api/v1/process/{instanceId}/status
```

---

## Troubleshooting

### Письмо не отправляется

1. Проверьте SMTP настройки:
```bash
atomd storage info
```

2. Проверьте логи:
```bash
tail -f build/logs/app.log | grep Email
```

3. Проверьте переменные процесса:
```bash
atomd process info {instanceId}
```

### Переменные не подставляются

Убедитесь что:
- Используется синтаксис `${variableName}`
- Переменная передана при запуске процесса
- Имя переменной написано правильно (регистр важен)

### HTML не отображается

- Проверьте что `contentType` = `HTML`
- Проверьте валидность HTML кода
- Убедитесь что используется `htmlBody` вместо `body`

---

## Дополнительные ресурсы

- [Email Connector Documentation](../EMAIL_CONNECTOR.md)
- [Connectors Overview](../../CONNECTORS.md)
- [CLI Commands Reference](../../CLI_COMMANDS.md)

