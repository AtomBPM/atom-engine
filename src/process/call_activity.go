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
)

// CallActivityExecutor executes call activities
// Исполнитель вызываемых активностей
type CallActivityExecutor struct{
	component ComponentInterface
}

// Execute executes call activity
// Выполняет вызываемую активность
func (cae *CallActivityExecutor) Execute(token *models.Token, element map[string]interface{}) (*ExecutionResult, error) {
	logger.Info("Executing call activity",
		logger.String("token_id", token.TokenID),
		logger.String("element_id", token.CurrentElementID))

	// Get activity name for logging
	activityName, _ := element["name"].(string)
	if activityName == "" {
		activityName = token.CurrentElementID
	}

	// Check if call activity was already executed for this token
	callActivityKey := fmt.Sprintf("call_activity_executed:%s", token.CurrentElementID)
	if executed, exists := token.GetExecutionContext(callActivityKey); exists && executed == true {
		logger.Info("Call activity already executed, continuing to next elements",
			logger.String("token_id", token.TokenID),
			logger.String("activity_name", activityName),
			logger.String("element_id", token.CurrentElementID))

		// Child process completed, continue to next elements
		outgoing, exists := element["outgoing"]
		if !exists {
			return &ExecutionResult{
				Success:      true,
				TokenUpdated: true,
				NextElements: []string{},
				Completed:    true,
			}, nil
		}

		var nextElements []string
		if outgoingList, ok := outgoing.([]interface{}); ok {
			for _, item := range outgoingList {
				if flowID, ok := item.(string); ok {
					nextElements = append(nextElements, flowID)
				}
			}
		} else if outgoingStr, ok := outgoing.(string); ok {
			nextElements = append(nextElements, outgoingStr)
		}

		return &ExecutionResult{
			Success:      true,
			TokenUpdated: false,
			NextElements: nextElements,
			Completed:    false,
		}, nil
	}

	// Extract called process ID from extension elements
	calledProcessID, err := cae.extractCalledProcessID(element)
	if err != nil {
		logger.Error("Failed to extract called process ID",
			logger.String("token_id", token.TokenID),
			logger.String("element_id", token.CurrentElementID),
			logger.String("error", err.Error()))
		return &ExecutionResult{
			Success: false,
			Error:   fmt.Sprintf("failed to extract called process ID: %v", err),
		}, nil
	}

	logger.Info("Starting child process instance",
		logger.String("token_id", token.TokenID),
		logger.String("activity_name", activityName),
		logger.String("called_process_id", calledProcessID))

	// Start child process instance
	childInstance, err := cae.component.StartProcessInstance(calledProcessID, token.Variables)
	if err != nil {
		logger.Error("Failed to start child process",
			logger.String("token_id", token.TokenID),
			logger.String("called_process_id", calledProcessID),
			logger.String("error", err.Error()))
		return &ExecutionResult{
			Success: false,
			Error:   fmt.Sprintf("failed to start child process: %v", err),
		}, nil
	}

	logger.Info("Child process started, waiting for completion",
		logger.String("token_id", token.TokenID),
		logger.String("child_instance_id", childInstance.InstanceID),
		logger.String("called_process_id", calledProcessID))

	// Mark call activity as executed for this element
	token.SetExecutionContext(callActivityKey, true)

	// Set token to wait for child process completion
	waitingFor := fmt.Sprintf("call_activity:%s", childInstance.InstanceID)

	return &ExecutionResult{
		Success:      true,
		TokenUpdated: true, // Need to update token to save execution context
		WaitingFor:   waitingFor,
		Completed:    false,
	}, nil
}

// NewCallActivityExecutor creates new call activity executor
// Создает новый исполнитель call activity
func NewCallActivityExecutor(component ComponentInterface) *CallActivityExecutor {
	return &CallActivityExecutor{
		component: component,
	}
}

// extractCalledProcessID extracts called process ID from extension elements
// Извлекает ID вызываемого процесса из extension elements
func (cae *CallActivityExecutor) extractCalledProcessID(element map[string]interface{}) (string, error) {
	// Get extension elements
	extensionElements, exists := element["extension_elements"]
	if !exists {
		return "", fmt.Errorf("no extension_elements found")
	}

	extensionElementsList, ok := extensionElements.([]interface{})
	if !ok {
		return "", fmt.Errorf("extension_elements is not a list")
	}

	for _, extElem := range extensionElementsList {
		extElemMap, ok := extElem.(map[string]interface{})
		if !ok {
			continue
		}

		// Check if this is extensionElements
		if extElemMap["type"] != "extensionElements" {
			continue
		}

		// Get extensions
		extensions, exists := extElemMap["extensions"]
		if !exists {
			continue
		}

		extensionsList, ok := extensions.([]interface{})
		if !ok {
			continue
		}

		for _, ext := range extensionsList {
			extMap, ok := ext.(map[string]interface{})
			if !ok {
				continue
			}

			// Check if this is calledElement
			if extMap["type"] != "calledElement" {
				continue
			}

			// Get called_element data
			calledElement, exists := extMap["called_element"]
			if !exists {
				continue
			}

			calledElementMap, ok := calledElement.(map[string]interface{})
			if !ok {
				continue
			}

			// Extract process_id
			processID, exists := calledElementMap["process_id"]
			if !exists {
				continue
			}

			processIDStr, ok := processID.(string)
			if !ok {
				continue
			}

			logger.Debug("Extracted called process ID",
				logger.String("process_id", processIDStr))

			return processIDStr, nil
		}
	}

	return "", fmt.Errorf("called process ID not found in extension elements")
}

// GetElementType returns element type
// Возвращает тип элемента
func (cae *CallActivityExecutor) GetElementType() string {
	return "callActivity"
}
