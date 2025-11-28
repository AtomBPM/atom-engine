/*
This file is part of the AtomBPMN (R) project.
Copyright (c) 2025 Matreska Market LLC (ООО «Matreska Market»).
Authors: Matreska Team.

This project is dual-licensed under AGPL-3.0 and AtomBPMN Commercial License.
*/

package process

import (
	"fmt"

	"atom-engine/src/core/logger"
	"atom-engine/src/core/models"
	"atom-engine/src/storage"
)

// CallbackHelper provides common callback processing functionality
// Предоставляет общую функциональность обработки callbacks
type CallbackHelper struct {
	storage       storage.Storage
	component     ComponentInterface
	tokenMovement *TokenMovement
}

// NewCallbackHelper creates new callback helper
// Создает новый callback helper
func NewCallbackHelper(storage storage.Storage, component ComponentInterface) *CallbackHelper {
	return &CallbackHelper{
		storage:       storage,
		component:     component,
		tokenMovement: NewTokenMovement(storage, component),
	}
}

// LoadAndValidateToken loads token and validates it's waiting for expected condition
// Загружает токен и проверяет что он ожидает ожидаемое условие
func (ch *CallbackHelper) LoadAndValidateToken(tokenID, expectedWaitingFor string) (*models.Token, error) {
	// Load the specific token
	token, err := ch.storage.LoadToken(tokenID)
	if err != nil {
		logger.Error("Failed to load token for callback",
			logger.String("token_id", tokenID),
			logger.String("error", err.Error()))
		return nil, fmt.Errorf("failed to load token %s: %w", tokenID, err)
	}

	// Check if token is waiting for expected condition
	if !token.IsWaiting() || token.WaitingFor != expectedWaitingFor {
		logger.Warn("Token is not waiting for expected condition",
			logger.String("token_id", tokenID),
			logger.String("token_state", string(token.State)),
			logger.String("token_waiting_for", token.WaitingFor),
			logger.String("expected_waiting_for", expectedWaitingFor))
		return nil, fmt.Errorf("token %s is not waiting for %s", tokenID, expectedWaitingFor)
	}

	logger.Info("Token confirmed waiting for condition",
		logger.String("token_id", tokenID),
		logger.String("waiting_for", expectedWaitingFor))

	return token, nil
}

// ProcessCallbackAndContinue processes callback and continues token execution
// Обрабатывает callback и продолжает выполнение токена
func (ch *CallbackHelper) ProcessCallbackAndContinue(
	token *models.Token,
	elementID string,
	variables map[string]interface{},
) error {
	// Clear waiting state and merge variables if provided
	token.ClearWaitingFor()
	if variables != nil {
		token.MergeVariables(variables)
	}

	// Cancel boundary timers when token leaves activity (Service Task, etc.)
	// Отменяем boundary таймеры когда токен покидает activity (Service Task, и т.д.)
	// Always try to cancel boundary timers regardless of token's boundary timer IDs
	// since there might be synchronization issues between token and storage
	// Всегда пытаемся отменить boundary таймеры независимо от boundary timer IDs токена
	// поскольку может быть рассинхронизация между токеном и storage
	logger.Info("Attempting to cancel boundary timers for token leaving activity",
		logger.String("token_id", token.TokenID),
		logger.String("element_id", elementID),
		logger.Bool("token_has_boundary_timers", token.HasBoundaryTimers()),
		logger.String("token_boundary_timer_ids", fmt.Sprintf("%v", token.GetBoundaryTimers())))

	if err := ch.component.CancelBoundaryTimersForToken(token.TokenID); err != nil {
		logger.Error("Failed to cancel boundary timers for token leaving activity",
			logger.String("token_id", token.TokenID),
			logger.String("element_id", elementID),
			logger.String("error", err.Error()))
		// Continue execution - boundary timer cancellation is not critical
	} else {
		logger.Info("Boundary timer cancellation completed for token leaving activity",
			logger.String("token_id", token.TokenID),
			logger.String("element_id", elementID))
	}

	// Update token in storage first
	if err := ch.storage.UpdateToken(token); err != nil {
		return fmt.Errorf("failed to update token: %w", err)
	}

	// Move token to next elements using existing logic
	// Use token.CurrentElementID instead of elementID parameter
	// since token is already positioned at the current element
	currentElementID := token.CurrentElementID
	if currentElementID == "" {
		currentElementID = elementID
	}

	logger.Info("DEBUG: About to move token to next elements",
		logger.String("token_id", token.TokenID),
		logger.String("token_current_element_id", token.CurrentElementID),
		logger.String("element_id_param", elementID),
		logger.String("using_element_id", currentElementID))

	if err := ch.tokenMovement.MoveTokenToNextElements(token, currentElementID); err != nil {
		logger.Error("DEBUG: Failed to move token to next elements",
			logger.String("token_id", token.TokenID),
			logger.String("current_element_id", currentElementID),
			logger.String("error", err.Error()))
		return fmt.Errorf("failed to move token to next elements: %w", err)
	}

	logger.Info("DEBUG: Successfully moved token to next elements",
		logger.String("token_id", token.TokenID),
		logger.String("current_element_id", currentElementID))

	logger.Info("Callback processed successfully - token execution continued",
		logger.String("element_id", elementID),
		logger.String("token_id", token.TokenID))

	return nil
}

// ProcessCallbackAndContinueWithFlows processes callback with explicit flow IDs
// Обрабатывает callback с явными ID потоков
func (ch *CallbackHelper) ProcessCallbackAndContinueWithFlows(
	token *models.Token,
	flowIDs []string,
	variables map[string]interface{},
) error {
	// Clear waiting state and merge variables if provided
	token.ClearWaitingFor()
	if variables != nil {
		token.MergeVariables(variables)
	}

	// Cancel boundary timers
	if err := ch.component.CancelBoundaryTimersForToken(token.TokenID); err != nil {
		logger.Error("Failed to cancel boundary timers",
			logger.String("token_id", token.TokenID),
			logger.String("error", err.Error()))
	}

	// Cancel EVENT timers for this token
	if err := ch.component.CancelEventTimersForToken(token.TokenID); err != nil {
		logger.Error("Failed to cancel EVENT timers",
			logger.String("token_id", token.TokenID),
			logger.String("error", err.Error()))
	}

	// Update token in storage
	if err := ch.storage.UpdateToken(token); err != nil {
		return fmt.Errorf("failed to update token: %w", err)
	}

	// Find target elements by flow IDs
	bpmnProcess, err := ch.tokenMovement.bpmnHelper.LoadBPMNProcess(token.ProcessKey)
	if err != nil {
		return fmt.Errorf("failed to load BPMN process: %w", err)
	}

	var targetElements []string
	for _, flowID := range flowIDs {
		targetElementID := ch.findTargetElementByFlowID(flowID, bpmnProcess)
		if targetElementID != "" {
			targetElements = append(targetElements, targetElementID)
		}
	}

	if len(targetElements) == 0 {
		return fmt.Errorf("no target elements found for flows: %v", flowIDs)
	}

	// Move token to first target element
	if len(targetElements) > 0 {
		token.MoveTo(targetElements[0])
		if err := ch.storage.UpdateToken(token); err != nil {
			return fmt.Errorf("failed to update token: %w", err)
		}
		return ch.component.ExecuteToken(token)
	}

	return nil
}

// GetBPMNHelper returns BPMN helper for external access
// Возвращает BPMN helper для внешнего доступа
func (ch *CallbackHelper) GetBPMNHelper() *BPMNHelper {
	return ch.tokenMovement.bpmnHelper
}

// findTargetElementByFlowID finds target element by flow ID
// Находит целевой элемент по ID потока
func (ch *CallbackHelper) findTargetElementByFlowID(flowID string, bpmnProcess *models.BPMNProcess) string {
	for elementID, element := range bpmnProcess.Elements {
		elementMap, ok := element.(map[string]interface{})
		if !ok {
			continue
		}

		incoming, exists := elementMap["incoming"]
		if !exists {
			continue
		}

		if incomingList, ok := incoming.([]interface{}); ok {
			for _, item := range incomingList {
				if incomingFlow, ok := item.(string); ok && incomingFlow == flowID {
					return elementID
				}
			}
		} else if incomingStr, ok := incoming.(string); ok && incomingStr == flowID {
			return elementID
		}
	}
	return ""
}
