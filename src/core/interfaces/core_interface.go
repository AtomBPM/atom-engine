/*
This file is part of the AtomBPMN (R) project.
Copyright (c) 2025 Matreska Market LLC (ООО «Matreska Market»).
Authors: Matreska Team.

This project is dual-licensed under AGPL-3.0 and AtomBPMN Commercial License.
*/

package interfaces

import (
	"context"

	"atom-engine/proto/timewheel/timewheelpb"
)

// CoreInterface defines the unified interface that core must provide to all consumers
// Определяет единый интерфейс, который core должен предоставлять всем потребителям
type CoreInterface interface {
	// Storage operations
	// Операции с хранилищем
	GetStorageStatus() (*StorageStatusResponse, error)
	GetStorageInfo() (*StorageInfoResponse, error)

	// Component access - typed interfaces
	// Доступ к компонентам - типизированные интерфейсы
	GetProcessComponent() ProcessComponentInterface
	GetTimewheelComponent() TimewheelComponentInterface
	GetStorageComponent() StorageComponentInterface

	// Component access - generic interfaces
	// Доступ к компонентам - общие интерфейсы
	GetMessagesComponent() interface{}
	GetJobsComponent() interface{}
	GetParserComponent() interface{}
	GetExpressionComponent() interface{}
	GetIncidentsComponent() interface{}
	GetAuthComponent() interface{}
	GetStorage() interface{}

	// Timer management
	// Управление таймерами
	GetTimewheelStats() (*timewheelpb.GetTimeWheelStatsResponse, error)
	GetTimersList(statusFilter string, limit int32) (*timewheelpb.ListTimersResponse, error)

	// JSON Message Routing
	// Маршрутизация JSON сообщений
	SendMessage(componentName, messageJSON string) error

	// Response Handling
	// Обработка ответов
	WaitForParserResponse(timeoutMs int) (string, error)
	WaitForJobsResponse(timeoutMs int) (string, error)
	WaitForMessagesResponse(timeoutMs int) (string, error)
	WaitForIncidentsResponse(timeoutMs int) (string, error)
}

// StorageStatusResponse represents storage status
// Представляет статус хранилища
type StorageStatusResponse struct {
	IsConnected   bool   `json:"is_connected"`
	IsHealthy     bool   `json:"is_healthy"`
	DatabasePath  string `json:"database_path"`
	Status        string `json:"status"`
	LastError     string `json:"last_error,omitempty"`
	ErrorCount    int    `json:"error_count"`
	Uptime        string `json:"uptime"`
	UptimeSeconds int64  `json:"uptime_seconds"`
	LastOperation string `json:"last_operation"`
}

// StorageInfoResponse represents storage information
// Представляет информацию о хранилище
type StorageInfoResponse struct {
	DatabasePath    string            `json:"database_path"`
	DatabaseSize    int64             `json:"database_size"`
	TotalSizeBytes  int64             `json:"total_size_bytes"`
	UsedSizeBytes   int64             `json:"used_size_bytes"`
	FreeSizeBytes   int64             `json:"free_size_bytes"`
	KeyCount        int               `json:"key_count"`
	TotalKeys       int64             `json:"total_keys"`
	LastCompaction  string            `json:"last_compaction"`
	MemoryUsage     int64             `json:"memory_usage"`
	DiskUsage       int64             `json:"disk_usage"`
	Configuration   map[string]string `json:"configuration"`
	Statistics      map[string]int64  `json:"statistics"`
	Health          HealthInfo        `json:"health"`
}

// HealthInfo represents health information
// Представляет информацию о здоровье системы
type HealthInfo struct {
	Status      string `json:"status"`
	LastCheck   string `json:"last_check"`
	Errors      int    `json:"errors"`
	Warnings    int    `json:"warnings"`
	Uptime      string `json:"uptime"`
	Performance string `json:"performance"`
}

// TimewheelComponentInterface defines timewheel component interface
// Определяет интерфейс timewheel компонента
type TimewheelComponentInterface interface {
	ProcessMessage(ctx context.Context, messageJSON string) error
	GetResponseChannel() <-chan string
	GetTimerInfo(timerID string) (level int, remainingSeconds int64, found bool)
}

// StorageComponentInterface defines storage component interface
// Определяет интерфейс storage компонента
type StorageComponentInterface interface {
	LoadAllTokens() ([]*Token, error)
	LoadTokensByState(state TokenState) ([]*Token, error)
	LoadToken(tokenID string) (*Token, error)
}

// ProcessComponentInterface defines process component interface
// Определяет интерфейс process компонента
type ProcessComponentInterface interface {
	StartProcessInstance(processKey string, variables map[string]interface{}) (*ProcessInstanceResult, error)
	GetProcessInstanceStatus(instanceID string) (*ProcessInstanceStatus, error)
	CancelProcessInstance(instanceID string, reason string) error
	ListProcessInstances(statusFilter string, limit int32) (*ProcessInstanceList, error)
}

// ProcessInstanceResult represents process instance creation result
// Представляет результат создания экземпляра процесса
type ProcessInstanceResult struct {
	InstanceID    string                 `json:"instance_id"`
	ProcessKey    string                 `json:"process_key"`
	Version       int32                  `json:"version"`
	Variables     map[string]interface{} `json:"variables"`
	Status        string                 `json:"status"`
	CreatedAt     string                 `json:"created_at"`
}

// ProcessInstanceStatus represents process instance status
// Представляет статус экземпляра процесса
type ProcessInstanceStatus struct {
	InstanceID    string                 `json:"instance_id"`
	ProcessKey    string                 `json:"process_key"`
	Status        string                 `json:"status"`
	Variables     map[string]interface{} `json:"variables"`
	CreatedAt     string                 `json:"created_at"`
	UpdatedAt     string                 `json:"updated_at"`
	CompletedAt   string                 `json:"completed_at,omitempty"`
}

// ProcessInstanceList represents list of process instances
// Представляет список экземпляров процессов
type ProcessInstanceList struct {
	Instances  []*ProcessInstanceStatus `json:"instances"`
	TotalCount int32                    `json:"total_count"`
	PageSize   int32                    `json:"page_size"`
	PageNumber int32                    `json:"page_number"`
}

// Token represents process token (simplified for interface)
// Представляет токен процесса (упрощенный для интерфейса)
type Token interface {
	GetID() string
	GetProcessInstanceID() string
	GetState() TokenState
}

// TokenState represents token state
// Представляет состояние токена
type TokenState string

const (
	TokenStateActive    TokenState = "ACTIVE"
	TokenStateCompleted TokenState = "COMPLETED"
	TokenStateCancelled TokenState = "CANCELLED"
)
