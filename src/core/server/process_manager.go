/*
This file is part of the AtomBPMN (R) project.
Copyright (c) 2025 Matreska Market LLC (ООО «Matreska Market»).
Authors: Matreska Team.

This project is dual-licensed under AGPL-3.0 and AtomBPMN Commercial License.
*/

package server

import (
	"atom-engine/src/core/grpc"
	"atom-engine/src/core/interfaces"
	"atom-engine/src/core/models"
	"atom-engine/src/process"
)

// GetProcessComponent returns process component for gRPC
// Возвращает process компонент для gRPC
func (c *Core) GetProcessComponent() grpc.ProcessComponentInterface {
	if c.processComp == nil {
		return nil
	}
	return &processComponentAdapter{comp: c.processComp}
}

// processComponentAdapter adapts process component to gRPC interface
// Адаптирует process компонент к gRPC интерфейсу
type processComponentAdapter struct {
	comp *process.Component
}

// StartProcessInstance starts new process instance
// Запускает новый экземпляр процесса
func (a *processComponentAdapter) StartProcessInstance(processKey string, variables map[string]interface{}) (*interfaces.ProcessInstanceResult, error) {
	instance, err := a.comp.StartProcessInstance(processKey, variables)
	if err != nil {
		return nil, err
	}

	return &grpc.ProcessInstanceResult{
		InstanceID:  instance.InstanceID,
		ProcessID:   instance.ProcessID,
		ProcessName: instance.ProcessName,
		State:       string(instance.State),
		StartedAt:   instance.StartedAt.Unix(),
		Variables:   instance.Variables,
	}, nil
}

// GetProcessInstanceStatus gets process instance status
// Получает статус экземпляра процесса
func (a *processComponentAdapter) GetProcessInstanceStatus(instanceID string) (*interfaces.ProcessInstanceStatus, error) {
	instance, err := a.comp.GetProcessInstanceStatus(instanceID)
	if err != nil {
		return nil, err
	}

	var completedAtStr string
	if instance.CompletedAt != nil {
		completedAtStr = instance.CompletedAt.Format("2006-01-02T15:04:05Z07:00")
	}

	return &interfaces.ProcessInstanceStatus{
		InstanceID:      instance.InstanceID,
		ProcessID:       instance.ProcessID,
		ProcessName:     instance.ProcessName,
		Status:          string(instance.State),
		State:           string(instance.State),
		CurrentActivity: instance.CurrentActivity,
		StartedAt:       instance.StartedAt.Unix(),
		UpdatedAt:       instance.UpdatedAt.Unix(),
		CompletedAt:     completedAtStr,
		Variables:       instance.Variables,
		CreatedAt:       instance.StartedAt.Format("2006-01-02T15:04:05Z07:00"), // Use StartedAt as CreatedAt
	}, nil
}

// CancelProcessInstance cancels process instance
// Отменяет экземпляр процесса
func (a *processComponentAdapter) CancelProcessInstance(instanceID string, reason string) error {
	return a.comp.CancelProcessInstance(instanceID, reason)
}

// ListProcessInstances lists process instances with optional filters
// Получает список экземпляров процессов с опциональными фильтрами
func (a *processComponentAdapter) ListProcessInstances(statusFilter string, processKeyFilter string, limit int) ([]*interfaces.ProcessInstanceStatus, error) {
	instances, err := a.comp.ListProcessInstances(statusFilter, processKeyFilter, limit)
	if err != nil {
		return nil, err
	}

	var results []*interfaces.ProcessInstanceStatus
	for _, instance := range instances {
		var completedAtStr string
		if instance.CompletedAt != nil {
			completedAtStr = instance.CompletedAt.Format("2006-01-02T15:04:05Z07:00")
		}

		result := &interfaces.ProcessInstanceStatus{
			InstanceID:      instance.InstanceID,
			ProcessID:       instance.ProcessID,
			ProcessName:     instance.ProcessName,
			Status:          string(instance.State),
			State:           string(instance.State),
			CurrentActivity: instance.CurrentActivity,
			StartedAt:       instance.StartedAt.Unix(),
			UpdatedAt:       instance.UpdatedAt.Unix(),
			CompletedAt:     completedAtStr,
			Variables:       instance.Variables,
			CreatedAt:       instance.StartedAt.Format("2006-01-02T15:04:05Z07:00"), // Use StartedAt as CreatedAt
		}
		results = append(results, result)
	}

	return results, nil
}

// GetTokensByProcessInstance gets tokens for process instance
// Получает токены для экземпляра процесса
func (a *processComponentAdapter) GetTokensByProcessInstance(instanceID string) ([]*models.Token, error) {
	return a.comp.GetTokensByProcessInstance(instanceID)
}

// GetActiveTokens gets active tokens for process instance
// Получает активные токены для экземпляра процесса
func (a *processComponentAdapter) GetActiveTokens(instanceID string) ([]*models.Token, error) {
	return a.comp.GetActiveTokens(instanceID)
}
