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

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// processJobsResponses processes jobs responses in background
// Обрабатывает ответы jobs в фоне
func (c *Core) processJobsResponses() {
	if c.jobsComp == nil {
		return
	}

	responseChannel := c.jobsComp.GetResponseChannel()

	for {
		select {
		case response := <-responseChannel:
			// Route message by type - only handle job callbacks, not API responses
			// Роутим сообщения по типу - обрабатываем только job callbacks, не API ответы
			if c.isJobCallback(response) {
				c.handleJobsResponse(response)
			} else {
				// This is an API response - ignore it, let WaitForJobsResponse handle it
				// Это API ответ - игнорируем, пусть WaitForJobsResponse его обрабатывает
				logger.Debug("Ignoring API response in jobs processor",
					logger.String("response_prefix", response[:min(len(response), 100)]))
			}
		}
	}
}

// isJobCallback determines if a response is a job callback (not an API response)
// Определяет является ли ответ job callback'ом (не API ответом)
func (c *Core) isJobCallback(response string) bool {
	// Simple heuristic: job callbacks typically contain "job_completed" or similar
	// API responses contain "response" in type field
	// Простая эвристика: job callback'и обычно содержат "job_completed" или похожее
	// API ответы содержат "response" в поле type
	return len(response) > 0 &&
		!contains(response, "_response") &&
		(contains(response, "job_completed") || contains(response, "job_failed"))
}

// contains checks if string s contains substring substr
// Проверяет содержит ли строка s подстроку substr
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		findInString(s, substr) != -1
}

// findInString finds substring in string (simple implementation)
// Находит подстроку в строке (простая реализация)
func findInString(s, substr string) int {
	if len(substr) == 0 {
		return 0
	}
	if len(s) < len(substr) {
		return -1
	}

	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// handleJobsResponse handles single jobs response
// Обрабатывает один ответ jobs
func (c *Core) handleJobsResponse(response string) {
	// Parse job callback response for readable logging
	// Парсим ответ job callback для читаемого логирования
	var jobResp struct {
		JobID             string `json:"job_id"`
		ElementID         string `json:"element_id"`
		TokenID           string `json:"token_id"`
		ProcessInstanceID string `json:"process_instance_id"`
		Status            string `json:"status"`
		CompletedAt       string `json:"completed_at"`
	}

	if err := json.Unmarshal([]byte(response), &jobResp); err == nil {
		logger.Info("CLI Job Callback",
			logger.String("element_id", jobResp.ElementID),
			logger.String("job_id", jobResp.JobID),
			logger.String("token_id", jobResp.TokenID),
			logger.String("process_instance_id", jobResp.ProcessInstanceID),
			logger.String("status", jobResp.Status),
			logger.String("completed_at", jobResp.CompletedAt))

		// Parse full callback for variables
		var fullCallback struct {
			JobID             string                 `json:"job_id"`
			ElementID         string                 `json:"element_id"`
			TokenID           string                 `json:"token_id"`
			ProcessInstanceID string                 `json:"process_instance_id"`
			Status            string                 `json:"status"`
			Variables         map[string]interface{} `json:"variables"`
			ErrorMessage      string                 `json:"error_message"`
		}

		json.Unmarshal([]byte(response), &fullCallback)

		// Forward job callback to process component
		// Передаем job callback в process component
		if c.processComp != nil {
			if err := c.processComp.HandleJobCallback(fullCallback.JobID, fullCallback.ElementID, fullCallback.TokenID, fullCallback.Status, fullCallback.ErrorMessage, fullCallback.Variables); err != nil {
				logger.Error("Failed to handle job callback in process component",
					logger.String("job_id", fullCallback.JobID),
					logger.String("element_id", fullCallback.ElementID),
					logger.String("token_id", fullCallback.TokenID),
					logger.String("status", fullCallback.Status),
					logger.String("error", err.Error()))
			} else {
				logger.Info("Job callback processed successfully",
					logger.String("job_id", fullCallback.JobID),
					logger.String("element_id", fullCallback.ElementID),
					logger.String("token_id", fullCallback.TokenID),
					logger.String("status", fullCallback.Status))
			}
		}
	}

	// Also log full JSON for debugging
	// Также логируем полный JSON для отладки
	logger.Debug("Job completed", logger.String("response", response))

	// Log job response to storage
	// Логируем ответ job'а в storage
	err := c.storage.LogSystemEvent(models.EventTypeReady, models.StatusSuccess, fmt.Sprintf("Job completed: %s", response))
	if err != nil {
		logger.Warn("Failed to log job response to storage", logger.String("error", err.Error()))
	}
}
