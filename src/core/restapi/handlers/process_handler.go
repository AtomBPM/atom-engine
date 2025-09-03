/*
This file is part of the AtomBPMN (R) project.
Copyright (c) 2025 Matreska Market LLC (ООО «Matreska Market»).
Authors: Matreska Team.

This project is dual-licensed under AGPL-3.0 and AtomBPMN Commercial License.
*/

package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"atom-engine/src/core/grpc"
	"atom-engine/src/core/logger"
	"atom-engine/src/core/restapi/middleware"
	"atom-engine/src/core/restapi/models"
	"atom-engine/src/core/restapi/utils"
)

// ProcessHandler handles process management HTTP requests
type ProcessHandler struct {
	coreInterface ProcessCoreInterface
	converter     *utils.Converter
	validator     *utils.Validator
}

// ProcessCoreInterface defines methods needed for process operations
type ProcessCoreInterface interface {
	GetProcessComponent() grpc.ProcessComponentInterface
}

// ProcessComponentInterface defines process component interface
type ProcessComponentInterface interface {
	StartProcessInstance(processKey string, variables map[string]interface{}) (*ProcessInstanceResult, error)
	GetProcessInstanceStatus(instanceID string) (*ProcessInstanceResult, error)
	CancelProcessInstance(instanceID string, reason string) error
	ListProcessInstances(statusFilter string, processKeyFilter string, limit int) ([]*ProcessInstanceResult, error)
	GetActiveTokens(instanceID string) ([]*Token, error)
}

// Process data types
type ProcessInstanceResult struct {
	InstanceID      string                 `json:"instance_id"`
	ProcessID       string                 `json:"process_id"`
	ProcessName     string                 `json:"process_name"`
	State           string                 `json:"state"`
	CurrentActivity string                 `json:"current_activity"`
	StartedAt       int64                  `json:"started_at"`
	UpdatedAt       int64                  `json:"updated_at"`
	CompletedAt     int64                  `json:"completed_at,omitempty"`
	Variables       map[string]interface{} `json:"variables"`
}

type Token struct {
	ID                string                 `json:"id"`
	State             TokenState             `json:"state"`
	ElementID         string                 `json:"element_id"`
	ProcessInstanceID string                 `json:"process_instance_id"`
	CreatedAt         int64                  `json:"created_at"`
	UpdatedAt         int64                  `json:"updated_at"`
	Variables         map[string]interface{} `json:"variables"`
}

type TokenState string

const (
	TokenStateActive    TokenState = "ACTIVE"
	TokenStateCompleted TokenState = "COMPLETED"
	TokenStateCancelled TokenState = "CANCELLED"
)

// NewProcessHandler creates new process handler
func NewProcessHandler(coreInterface ProcessCoreInterface) *ProcessHandler {
	return &ProcessHandler{
		coreInterface: coreInterface,
		converter:     utils.NewConverter(),
		validator:     utils.NewValidator(),
	}
}

// RegisterRoutes registers process routes
func (h *ProcessHandler) RegisterRoutes(router *gin.RouterGroup, authMiddleware *middleware.AuthMiddleware) {
	processes := router.Group("/processes")

	// Apply auth middleware with required permissions
	if authMiddleware != nil {
		processes.Use(authMiddleware.RequirePermission("process"))
	}

	{
		processes.POST("", h.StartProcess)
		processes.GET("", h.ListProcesses)
		processes.GET("/:id", h.GetProcessStatus)
		processes.DELETE("/:id", h.CancelProcess)
		processes.GET("/:id/tokens", h.GetProcessTokens)
		processes.GET("/:id/tokens/trace", h.GetTokenTrace)
	}
}

// StartProcess handles POST /api/v1/processes
// @Summary Start process instance
// @Description Start a new process instance with optional variables
// @Tags processes
// @Accept json
// @Produce json
// @Param request body models.StartProcessRequest true "Process start request"
// @Success 201 {object} models.APIResponse{data=ProcessInstanceResult}
// @Failure 400 {object} models.APIResponse{error=models.APIError}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 404 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/processes [post]
func (h *ProcessHandler) StartProcess(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse request body
	var req models.StartProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Error("Failed to parse start process request",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.BadRequestError("Invalid request body: " + err.Error())
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Validate request
	if err := req.Validate(); err != nil {
		if apiErr, ok := err.(*models.APIError); ok {
			c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		} else {
			c.JSON(http.StatusBadRequest, models.ErrorResponse(models.BadRequestError(err.Error()), requestID))
		}
		return
	}

	logger.Debug("Starting process instance",
		logger.String("request_id", requestID),
		logger.String("process_key", req.ProcessKey),
		logger.String("client_ip", c.ClientIP()))

	// Get process component
	processComp := h.coreInterface.GetProcessComponent()
	if processComp == nil {
		logger.Error("Process component not available",
			logger.String("request_id", requestID))

		apiErr := models.InternalServerError("Process service not available")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Start process instance
	result, err := processComp.StartProcessInstance(req.ProcessKey, req.Variables)
	if err != nil {
		logger.Error("Failed to start process instance",
			logger.String("request_id", requestID),
			logger.String("process_key", req.ProcessKey),
			logger.String("error", err.Error()))

		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Info("Process instance started",
		logger.String("request_id", requestID),
		logger.String("process_key", req.ProcessKey),
		logger.String("instance_id", result.InstanceID))

	c.JSON(http.StatusCreated, models.SuccessResponse(result, requestID))
}

// ListProcesses handles GET /api/v1/processes
// @Summary List process instances
// @Description Get list of process instances with filtering and pagination
// @Tags processes
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param status query string false "Status filter (active, completed, cancelled)"
// @Param process_key query string false "Process key filter"
// @Param tenant_id query string false "Tenant ID filter"
// @Success 200 {object} models.PaginatedResponse{data=[]ProcessInstanceResult}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/processes [get]
func (h *ProcessHandler) ListProcesses(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse query parameters
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "20")
	status := c.Query("status")
	processKey := c.Query("process_key")
	_ = c.Query("tenant_id") // tenantID for future implementation

	// Parse and validate pagination
	paginationHelper := utils.NewPaginationHelper()
	params, apiErr := paginationHelper.ParseAndValidate(pageStr, limitStr)
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Validate status filter
	if status != "" {
		validStatuses := []string{"active", "completed", "cancelled"}
		if apiErr := h.validator.ValidateStringEnum(status, "status", validStatuses); apiErr != nil {
			c.JSON(http.StatusBadRequest, models.ErrorResponse(
				models.NewValidationError("Invalid status filter", []models.ValidationError{*apiErr}),
				requestID))
			return
		}
	}

	logger.Debug("Listing process instances",
		logger.String("request_id", requestID),
		logger.Int("page", params.Page),
		logger.Int("limit", params.Limit),
		logger.String("status", status),
		logger.String("process_key", processKey))

	// Get process component
	processComp := h.coreInterface.GetProcessComponent()
	if processComp == nil {
		apiErr := models.InternalServerError("Process service not available")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	// List process instances
	instances, err := processComp.ListProcessInstances(status, processKey, params.Limit*params.Page)
	if err != nil {
		logger.Error("Failed to list process instances",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Apply client-side pagination (since the component returns all results)
	paginatedInstances, paginationInfo := utils.ApplyPagination(instances, params.Page, params.Limit)

	logger.Info("Process instances listed",
		logger.String("request_id", requestID),
		logger.Int("count", len(instances)),
		logger.Int("page", params.Page))

	paginatedResp := models.PaginatedSuccessResponse(paginatedInstances, paginationInfo, requestID)
	c.JSON(http.StatusOK, paginatedResp)
}

// GetProcessStatus handles GET /api/v1/processes/:id
// @Summary Get process instance status
// @Description Get detailed status of a specific process instance
// @Tags processes
// @Produce json
// @Param id path string true "Process instance ID"
// @Success 200 {object} models.APIResponse{data=ProcessInstanceResult}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 404 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/processes/{id} [get]
func (h *ProcessHandler) GetProcessStatus(c *gin.Context) {
	requestID := h.getRequestID(c)
	instanceID := c.Param("id")

	if instanceID == "" {
		apiErr := models.BadRequestError("Process instance ID is required")
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Validate instance ID format
	if apiErr := h.validator.ValidateID(instanceID, "instance_id"); apiErr != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(
			models.NewValidationError("Invalid instance ID format", []models.ValidationError{*apiErr}),
			requestID))
		return
	}

	logger.Debug("Getting process instance status",
		logger.String("request_id", requestID),
		logger.String("instance_id", instanceID))

	// Get process component
	processComp := h.coreInterface.GetProcessComponent()
	if processComp == nil {
		apiErr := models.InternalServerError("Process service not available")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Get process status
	result, err := processComp.GetProcessInstanceStatus(instanceID)
	if err != nil {
		logger.Error("Failed to get process instance status",
			logger.String("request_id", requestID),
			logger.String("instance_id", instanceID),
			logger.String("error", err.Error()))

		apiErr := h.converter.GRPCErrorToAPIError(err)
		if apiErr.Code == models.ErrorCodeResourceNotFound {
			apiErr = models.ProcessNotFoundError(instanceID)
		}
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Info("Process instance status retrieved",
		logger.String("request_id", requestID),
		logger.String("instance_id", instanceID),
		logger.String("state", result.State))

	c.JSON(http.StatusOK, models.SuccessResponse(result, requestID))
}

// CancelProcess handles DELETE /api/v1/processes/:id
// @Summary Cancel process instance
// @Description Cancel a running process instance
// @Tags processes
// @Accept json
// @Produce json
// @Param id path string true "Process instance ID"
// @Param request body models.CancelProcessRequest false "Cancellation request"
// @Success 200 {object} models.APIResponse{data=models.DeleteResponse}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 404 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/processes/{id} [delete]
func (h *ProcessHandler) CancelProcess(c *gin.Context) {
	requestID := h.getRequestID(c)
	instanceID := c.Param("id")

	if instanceID == "" {
		apiErr := models.BadRequestError("Process instance ID is required")
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Parse optional request body
	var req models.CancelProcessRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			logger.Warn("Failed to parse cancel request body, using defaults",
				logger.String("request_id", requestID),
				logger.String("error", err.Error()))
		}
	}

	logger.Debug("Cancelling process instance",
		logger.String("request_id", requestID),
		logger.String("instance_id", instanceID),
		logger.String("reason", req.Reason))

	// Get process component
	processComp := h.coreInterface.GetProcessComponent()
	if processComp == nil {
		apiErr := models.InternalServerError("Process service not available")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Cancel process instance
	err := processComp.CancelProcessInstance(instanceID, req.Reason)
	if err != nil {
		logger.Error("Failed to cancel process instance",
			logger.String("request_id", requestID),
			logger.String("instance_id", instanceID),
			logger.String("error", err.Error()))

		apiErr := h.converter.GRPCErrorToAPIError(err)
		if apiErr.Code == models.ErrorCodeResourceNotFound {
			apiErr = models.ProcessNotFoundError(instanceID)
		}
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	response := &models.DeleteResponse{
		ID:      instanceID,
		Message: "Process instance cancelled successfully",
	}

	logger.Info("Process instance cancelled",
		logger.String("request_id", requestID),
		logger.String("instance_id", instanceID))

	c.JSON(http.StatusOK, models.SuccessResponse(response, requestID))
}

// GetProcessTokens handles GET /api/v1/processes/:id/tokens
func (h *ProcessHandler) GetProcessTokens(c *gin.Context) {
	requestID := h.getRequestID(c)
	_ = c.Param("id") // instanceID for future implementation

	// Implementation details...
	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Get process tokens endpoint not implemented yet"),
		requestID))
}

// GetTokenTrace handles GET /api/v1/processes/:id/tokens/trace
func (h *ProcessHandler) GetTokenTrace(c *gin.Context) {
	requestID := h.getRequestID(c)
	_ = c.Param("id") // instanceID for future implementation

	// Implementation details...
	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Get token trace endpoint not implemented yet"),
		requestID))
}

// Helper methods

func (h *ProcessHandler) getRequestID(c *gin.Context) string {
	if requestID := c.GetHeader("X-Request-ID"); requestID != "" {
		return requestID
	}
	return "process_" + h.generateRandomString(8)
}

func (h *ProcessHandler) generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = charset[i%len(charset)]
	}
	return string(result)
}

// ProcessStats provides process statistics
type ProcessStats struct {
	TotalInstances       int64            `json:"total_instances"`
	ActiveInstances      int64            `json:"active_instances"`
	CompletedInstances   int64            `json:"completed_instances"`
	CancelledInstances   int64            `json:"cancelled_instances"`
	InstancesByStatus    map[string]int64 `json:"instances_by_status"`
	InstancesByProcess   map[string]int64 `json:"instances_by_process"`
	AverageExecutionTime float64          `json:"average_execution_time_ms"`
}

// GetProcessStats returns process statistics
func (h *ProcessHandler) GetProcessStats() (*ProcessStats, error) {
	processComp := h.coreInterface.GetProcessComponent()
	if processComp == nil {
		return nil, fmt.Errorf("process component not available")
	}

	// Get all instances to calculate stats
	allInstances, err := processComp.ListProcessInstances("", "", 0)
	if err != nil {
		return nil, err
	}

	stats := &ProcessStats{
		TotalInstances:     int64(len(allInstances)),
		InstancesByStatus:  make(map[string]int64),
		InstancesByProcess: make(map[string]int64),
	}

	// Calculate statistics
	for _, instance := range allInstances {
		switch instance.State {
		case "ACTIVE":
			stats.ActiveInstances++
		case "COMPLETED":
			stats.CompletedInstances++
		case "CANCELLED":
			stats.CancelledInstances++
		}

		stats.InstancesByStatus[instance.State]++
		stats.InstancesByProcess[instance.ProcessID]++
	}

	return stats, nil
}
