# Atom Engine Connectors

Список поддерживаемых коннекторов в Atom Engine.

## Доступные коннекторы

### Email Connector

**Тип:** `io.camunda:email:1`  
**Шаблон:** `io.camunda.connectors.email.v1`  
**Статус:** ✅ Полностью реализован

Коннектор для отправки email сообщений через SMTP.

**Основные возможности:**
- Отправка Plain Text и HTML писем
- Поддержка SMTP аутентификации
- Различные протоколы шифрования (NONE, TLS, SSL, STARTTLS)
- Шаблонизация с переменными `${variable}`
- Поддержка CC, BCC
- Декодирование HTML entities
- Вложения (attachments)

**Документация:** [Email Connector](connectors/EMAIL_CONNECTOR.md)

**Пример использования:**
```xml
<bpmn:serviceTask id="Activity_Email" name="Send Email" 
                  zeebe:modelerTemplate="io.camunda.connectors.email.v1">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="io.camunda:email:1" retries="3" />
    <zeebe:ioMapping>
      <zeebe:input source="simple" target="authentication.type" />
      <zeebe:input source="user@example.com" target="authentication.username" />
      <zeebe:input source="password" target="authentication.password" />
      <zeebe:input source="smtp.example.com" target="data.smtpConfig.smtpHost" />
      <zeebe:input source="=587" target="data.smtpConfig.smtpPort" />
      <zeebe:input source="STARTTLS" target="data.smtpConfig.smtpCryptographicProtocol" />
      <zeebe:input source="sender@example.com" target="data.smtpAction.from" />
      <zeebe:input source="recipient@example.com" target="data.smtpAction.to" />
      <zeebe:input source="Subject" target="data.smtpAction.subject" />
      <zeebe:input source="HTML" target="data.smtpAction.contentType" />
      <zeebe:input source="=emailBody" target="data.smtpAction.htmlBody" />
    </zeebe:ioMapping>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

---

## Roadmap

Планируемые коннекторы для реализации:

### REST Connector
**Статус:** 🚧 В разработке  
**Тип:** `io.camunda:http-json:1`

HTTP/REST коннектор для взаимодействия с внешними API.

### Kafka Connector
**Статус:** 📋 Планируется  
**Тип:** `io.camunda:connector-kafka:1`

Коннектор для работы с Apache Kafka.

### Webhook Connector
**Статус:** 📋 Планируется  
**Тип:** `io.camunda:webhook:1`

Коннектор для приема входящих webhook запросов.

### Database Connector
**Статус:** 📋 Планируется  
**Тип:** `io.camunda:sql:1`

Коннектор для работы с базами данных.

---

## Создание собственных коннекторов

### Архитектура коннектора

Каждый коннектор должен реализовывать интерфейс `ElementExecutor`:

```go
type ElementExecutor interface {
    Execute(token *models.Token, element map[string]interface{}) (*ExecutionResult, error)
    GetElementType() string
}
```

### Пример структуры коннектора

```go
package process

import (
    "atom-engine/src/core/logger"
    "atom-engine/src/core/models"
)

type MyConnectorExecutor struct {
    processComponent ComponentInterface
}

func NewMyConnectorExecutor(processComponent ComponentInterface) *MyConnectorExecutor {
    return &MyConnectorExecutor{
        processComponent: processComponent,
    }
}

func (mce *MyConnectorExecutor) GetElementType() string {
    return "serviceTask"
}

func (mce *MyConnectorExecutor) Execute(
    token *models.Token,
    element map[string]interface{},
) (*ExecutionResult, error) {
    // Извлечение конфигурации из ioMapping
    config, err := mce.extractConfig(element, token.Variables)
    if err != nil {
        return &ExecutionResult{
            Success:   false,
            Error:     err.Error(),
            Completed: false,
        }, nil
    }

    // Выполнение логики коннектора
    result, err := mce.doWork(config)
    if err != nil {
        return &ExecutionResult{
            Success:   false,
            Error:     err.Error(),
            Completed: false,
        }, nil
    }

    // Обновление переменных токена
    token.Variables["response"] = result

    // Получение следующих элементов
    nextElements := getNextElements(element)

    return &ExecutionResult{
        Success:      true,
        TokenUpdated: true,
        NextElements: nextElements,
        Completed:    false,
    }, nil
}
```

### Регистрация коннектора

Добавьте коннектор в `ExecutorRegistry`:

```go
// src/process/executor_registry.go
func (er *ExecutorRegistry) registerExecutors() {
    // ... существующие коннекторы
    
    // Регистрация нового коннектора
    er.executors["io.camunda:myconnector:1"] = NewMyConnectorExecutor(er.processComponent)
}
```

### Определение в BPMN

```xml
<bpmn:serviceTask id="Activity_MyConnector" name="My Connector" 
                  zeebe:modelerTemplate="io.camunda.connectors.myconnector.v1">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="io.camunda:myconnector:1" retries="3" />
    <zeebe:ioMapping>
      <zeebe:input source="value1" target="config.param1" />
      <zeebe:input source="=variable1" target="config.param2" />
    </zeebe:ioMapping>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

### Best Practices

1. **Извлечение конфигурации:**
   - Используйте `extractConfig` для парсинга `ioMapping`
   - Валидируйте обязательные параметры
   - Поддерживайте переменные с префиксом `=`

2. **Обработка переменных:**
   - Разрешайте переменные через `resolveInputValue`
   - Поддерживайте шаблонизацию `${variable}`
   - Передавайте `token.Variables` для доступа к контексту

3. **Обработка ошибок:**
   - Логируйте ошибки с уровнем ERROR
   - Возвращайте понятные сообщения об ошибках
   - Поддерживайте механизм retry через `retries`

4. **Логирование:**
   - INFO: начало выполнения, успешное завершение
   - ERROR: ошибки выполнения
   - DEBUG: детали конфигурации (только при необходимости)

5. **Ответ коннектора:**
   - Сохраняйте результат в `token.Variables["response"]`
   - Используйте структурированные данные (map/struct)
   - Включайте статус, timestamp, идентификаторы

### Тестирование коннектора

```go
func TestMyConnector(t *testing.T) {
    // Создание mock process component
    mockComponent := &MockProcessComponent{}
    
    // Создание коннектора
    connector := NewMyConnectorExecutor(mockComponent)
    
    // Подготовка токена и элемента
    token := &models.Token{
        TokenID: "test-token",
        Variables: map[string]interface{}{
            "param1": "value1",
        },
    }
    
    element := map[string]interface{}{
        "id": "TestElement",
        "extension_elements": []interface{}{
            // ... ioMapping конфигурация
        },
    }
    
    // Выполнение
    result, err := connector.Execute(token, element)
    
    // Проверки
    assert.NoError(t, err)
    assert.True(t, result.Success)
    assert.NotNil(t, token.Variables["response"])
}
```

---

## Совместимость с Camunda

Все коннекторы Atom Engine разработаны с учетом совместимости с Camunda 8:

- ✅ Используются стандартные типы коннекторов Camunda
- ✅ Поддержка `zeebe:taskDefinition` и `zeebe:ioMapping`
- ✅ Совместимость с Camunda Modeler шаблонами
- ✅ Синтаксис переменных `${variable}` как в Camunda
- ✅ Механизм retry и error handling

---

## См. также

- [Email Connector Documentation](connectors/EMAIL_CONNECTOR.md)
- [Process Management](PROCESS_MANAGEMENT.md)
- [Variables and Expressions](VARIABLES_AND_EXPRESSIONS.md)
- [CLI Commands Reference](CLI_COMMANDS.md)

