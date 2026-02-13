/*
This file is part of the AtomBPMN (R) project.
Copyright (c) 2025 Matreska Market LLC (ООО «Matreska Market»).
Authors: Matreska Team.

This project is dual-licensed under AGPL-3.0 and AtomBPMN Commercial License.
*/

package server

import (
	"encoding/json"
	"fmt"

	"atom-engine/src/core/logger"
	"atom-engine/src/core/models"
)

// processMessagesResponses processes messages responses in background
// Обрабатывает ответы messages в фоне
// NOTE: This function handles ONLY correlation events for CLI, NOT API responses for REST
func (c *Core) processMessagesResponses() {
	if c.messagesComp == nil {
		logger.Warn("Messages component is nil in processMessagesResponses")
		return
	}

	// Do NOT read from response channel here - REST handlers need it
	// This processor is disabled to allow REST API handlers to receive responses
	// Correlation events will be handled through different mechanism if needed
	logger.Info("Messages response processor started (disabled for REST API compatibility)")
	
	// Block this goroutine but don't consume channel
	select {}
}

// handleMessagesResponse handles single messages response
// Обрабатывает один ответ messages
func (c *Core) handleMessagesResponse(response string) {
	// Parse message callback response for readable logging
	// Парсим ответ message callback для читаемого логирования
	var messageResp struct {
		MessageID         string                 `json:"message_id"`
		MessageName       string                 `json:"message_name"`
		CorrelationKey    string                 `json:"correlation_key"`
		TokenID           string                 `json:"token_id"`
		ProcessInstanceID string                 `json:"process_instance_id"`
		Variables         map[string]interface{} `json:"variables"`
		CorrelatedAt      string                 `json:"correlated_at"`
		EventType         string                 `json:"event_type"`
	}

	if err := json.Unmarshal([]byte(response), &messageResp); err == nil {
		logger.Info("CLI Message Callback",
			logger.String("event_type", messageResp.EventType),
			logger.String("message_id", messageResp.MessageID),
			logger.String("message_name", messageResp.MessageName),
			logger.String("correlation_key", messageResp.CorrelationKey),
			logger.String("token_id", messageResp.TokenID),
			logger.String("process_instance_id", messageResp.ProcessInstanceID))

		// Forward message callback to process component if it's a correlation event
		// Передаем message callback в process component если это событие корреляции
		logger.Info("🔍 [DEBUG] Checking correlation event forwarding",
			logger.String("event_type", messageResp.EventType),
			logger.Bool("is_correlation", messageResp.EventType == "correlation"),
			logger.Bool("process_comp_exists", c.processComp != nil))

		if messageResp.EventType == "correlation" && c.processComp != nil {
			logger.Info("🔍 [DEBUG] About to forward correlation callback to process component - CRITICAL POINT",
				logger.String("message_id", messageResp.MessageID),
				logger.String("message_name", messageResp.MessageName),
				logger.String("token_id", messageResp.TokenID),
				logger.String("correlation_key", messageResp.CorrelationKey))

			logger.Info("🚀 [DEBUG] Calling c.processComp.HandleMessageCallback - CRASH POINT",
				logger.String("message_id", messageResp.MessageID),
				logger.String("token_id", messageResp.TokenID))

			if err := c.processComp.HandleMessageCallback(
				messageResp.MessageID,
				messageResp.MessageName,
				messageResp.CorrelationKey,
				messageResp.TokenID,
				messageResp.Variables,
			); err != nil {
				logger.Error("Failed to handle message callback in process component",
					logger.String("message_id", messageResp.MessageID),
					logger.String("message_name", messageResp.MessageName),
					logger.String("token_id", messageResp.TokenID),
					logger.String("error", err.Error()))
			} else {
				logger.Info("Message callback processed successfully",
					logger.String("message_id", messageResp.MessageID),
					logger.String("message_name", messageResp.MessageName),
					logger.String("token_id", messageResp.TokenID))
			}
		} else {
			logger.Info("Skipping callback forwarding",
				logger.String("event_type", messageResp.EventType),
				logger.Bool("process_comp_available", c.processComp != nil))
		}
	} else {
		logger.Error("Failed to parse message callback response",
			logger.String("response", response),
			logger.String("error", err.Error()))
	}

	// Also log full JSON for debugging
	// Также логируем полный JSON для отладки
	logger.Debug("Message callback", logger.String("response", response))

	// Log message response to storage
	// Логируем ответ сообщения в storage
	err := c.storage.LogSystemEvent(models.EventTypeReady, models.StatusSuccess,
		fmt.Sprintf("Message callback: %s", response))
	if err != nil {
		logger.Warn("Failed to log message callback to storage", logger.String("error", err.Error()))
	}
}
