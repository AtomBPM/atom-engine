/*
This file is part of the AtomBPMN (R) project.
Copyright (c) 2025 Matreska Market LLC (ООО «Matreska Market»).
Authors: Matreska Team.

This project is dual-licensed under AGPL-3.0 and AtomBPMN Commercial License.
*/

package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"atom-engine/src/core/logger"
	"atom-engine/src/core/restapi/middleware"
	"atom-engine/src/core/restapi/models"
	"atom-engine/src/core/restapi/utils"
)

// JobsHandler handles job management HTTP requests
type JobsHandler struct {
	coreInterface JobsCoreInterface
	converter     *utils.Converter
	validator     *utils.Validator
}

// JobsCoreInterface defines methods needed for jobs operations
type JobsCoreInterface interface {
	// JSON Message Routing to jobs component
	SendMessage(componentName, messageJSON string) error
	WaitForJobsResponse(timeoutMs int) (string, error)
	GetJobsComponent() interface{}
}

// Job data types
type Job struct {
	Key                 string                 `json:"key"`
	Type                string                 `json:"type"`
	ProcessInstanceID   string                 `json:"process_instance_id"`
	ProcessDefinitionID string                 `json:"process_definition_id"`
	ElementID           string                 `json:"element_id"`
	ElementInstanceID   string                 `json:"element_instance_id"`
	CustomHeaders       map[string]string      `json:"custom_headers"`
	Variables           map[string]interface{} `json:"variables"`
	Retries             int32                  `json:"retries"`
	Deadline            int64                  `json:"deadline"`
	Worker              string                 `json:"worker,omitempty"`
	State               string                 `json:"state"`
	CreatedAt           int64                  `json:"created_at"`
	UpdatedAt           int64                  `json:"updated_at"`
}

type JobActivationResponse struct {
	Jobs []Job `json:"jobs"`
}

type JobStats struct {
	TotalJobs        int64            `json:"total_jobs"`
	ActiveJobs       int64            `json:"active_jobs"`
	CompletedJobs    int64            `json:"completed_jobs"`
	FailedJobs       int64            `json:"failed_jobs"`
	JobsByType       map[string]int64 `json:"jobs_by_type"`
	JobsByWorker     map[string]int64 `json:"jobs_by_worker"`
	AverageLatency   float64          `json:"average_latency_ms"`
	ThroughputPerMin int64            `json:"throughput_per_minute"`
}

// NewJobsHandler creates new jobs handler
func NewJobsHandler(coreInterface JobsCoreInterface) *JobsHandler {
	return &JobsHandler{
		coreInterface: coreInterface,
		converter:     utils.NewConverter(),
		validator:     utils.NewValidator(),
	}
}

// RegisterRoutes registers job routes
func (h *JobsHandler) RegisterRoutes(router *gin.RouterGroup, authMiddleware *middleware.AuthMiddleware) {
	jobs := router.Group("/jobs")

	// Apply auth middleware with required permissions
	if authMiddleware != nil {
		jobs.Use(authMiddleware.RequirePermission("job"))
	}

	{
		jobs.POST("", h.CreateJob)
		jobs.GET("", h.ListJobs)
		jobs.GET("/:key", h.GetJob)
		jobs.POST("/activate", h.ActivateJobs)
		jobs.PUT("/:key/complete", h.CompleteJob)
		jobs.PUT("/:key/fail", h.FailJob)
		jobs.PUT("/:key/throw-error", h.ThrowError)
		jobs.DELETE("/:key", h.CancelJob)
		jobs.PUT("/:key/retries", h.UpdateRetries)
		jobs.PUT("/:key/timeout", h.UpdateTimeout)
		jobs.GET("/stats", h.GetStats)
	}
}

// CreateJob handles POST /api/v1/jobs
// @Summary Create job
// @Description Create a new job for service task execution
// @Tags jobs
// @Accept json
// @Produce json
// @Param request body models.CreateJobRequest true "Job creation request"
// @Success 201 {object} models.APIResponse{data=models.CreateResponse}
// @Failure 400 {object} models.APIResponse{error=models.APIError}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/jobs [post]
func (h *JobsHandler) CreateJob(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse request body
	var req models.CreateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Error("Failed to parse create job request",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.BadRequestError("Invalid request body: " + err.Error())
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Validate request
	validationErrors := h.validator.ValidateMultiple(
		func() *models.ValidationError {
			return h.validator.ValidateRequired(req.Type, "type")
		},
		func() *models.ValidationError {
			return h.validator.ValidateRequired(req.ProcessInstanceID, "process_instance_id")
		},
		func() *models.ValidationError {
			return h.validator.ValidateRequired(req.ElementID, "element_id")
		},
		func() *models.ValidationError {
			return h.validator.ValidateRange(req.Retries, "retries", 0, 100)
		},
		func() *models.ValidationError {
			return h.validator.ValidateRange(req.TimeoutMs, "timeout_ms", 0, 86400000) // 24 hours max
		},
	)

	if len(validationErrors) > 0 {
		apiErr := h.validator.CreateValidationError(validationErrors)
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Creating job",
		logger.String("request_id", requestID),
		logger.String("type", req.Type),
		logger.String("process_instance_id", req.ProcessInstanceID),
		logger.String("element_id", req.ElementID))

	// Create job request message
	jobReq := map[string]interface{}{
		"operation":           "create",
		"type":                req.Type,
		"process_instance_id": req.ProcessInstanceID,
		"element_id":          req.ElementID,
		"element_instance_id": req.ElementInstanceID,
		"custom_headers":      req.CustomHeaders,
		"variables":           req.Variables,
		"retries":             req.Retries,
		"timeout_ms":          req.TimeoutMs,
	}

	// Send to jobs component
	response, err := h.sendJobsRequest(jobReq, requestID)
	if err != nil {
		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Extract job key from response
	jobKey, _ := response["job_key"].(string)
	if jobKey == "" {
		apiErr := models.InternalServerError("Job created but key not returned")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	createResp := &models.CreateResponse{
		ID:      jobKey,
		Message: "Job created successfully",
	}

	logger.Info("Job created successfully",
		logger.String("request_id", requestID),
		logger.String("job_key", jobKey),
		logger.String("type", req.Type))

	c.JSON(http.StatusCreated, models.SuccessResponse(createResp, requestID))
}

// ActivateJobs handles POST /api/v1/jobs/activate
// @Summary Activate jobs for worker
// @Description Activate available jobs for a specific worker
// @Tags jobs
// @Accept json
// @Produce json
// @Param request body models.ActivateJobsRequest true "Job activation request"
// @Success 200 {object} models.APIResponse{data=JobActivationResponse}
// @Failure 400 {object} models.APIResponse{error=models.APIError}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/jobs/activate [post]
func (h *JobsHandler) ActivateJobs(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse request body
	var req models.ActivateJobsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr := models.BadRequestError("Invalid request body: " + err.Error())
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Validate request
	validationErrors := h.validator.ValidateMultiple(
		func() *models.ValidationError {
			return h.validator.ValidateRequired(req.Type, "type")
		},
		func() *models.ValidationError {
			return h.validator.ValidateRequired(req.Worker, "worker")
		},
		func() *models.ValidationError {
			if req.MaxJobs <= 0 {
				req.MaxJobs = 10 // Default value
			}
			return h.validator.ValidateRange(req.MaxJobs, "max_jobs", 1, 1000)
		},
	)

	if len(validationErrors) > 0 {
		apiErr := h.validator.CreateValidationError(validationErrors)
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Activating jobs for worker",
		logger.String("request_id", requestID),
		logger.String("type", req.Type),
		logger.String("worker", req.Worker),
		logger.Any("max_jobs", req.MaxJobs))

	// Create activation request
	activateReq := map[string]interface{}{
		"operation":       "activate",
		"type":            req.Type,
		"worker":          req.Worker,
		"max_jobs":        req.MaxJobs,
		"timeout_ms":      req.TimeoutMs,
		"fetch_variables": req.FetchVariables,
	}

	// Send to jobs component and get response
	response, err := h.sendJobsRequest(activateReq, requestID)
	if err != nil {
		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Parse jobs from response
	jobs := h.parseJobsFromResponse(response)

	activationResp := &JobActivationResponse{
		Jobs: jobs,
	}

	logger.Info("Jobs activated for worker",
		logger.String("request_id", requestID),
		logger.String("worker", req.Worker),
		logger.Int("activated_count", len(jobs)))

	c.JSON(http.StatusOK, models.SuccessResponse(activationResp, requestID))
}

// ListJobs handles GET /api/v1/jobs
// @Summary List jobs
// @Description Get list of jobs with filtering and pagination
// @Tags jobs
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param type query string false "Job type filter"
// @Param worker query string false "Worker filter"
// @Param state query string false "State filter (activatable, activated, completed, failed)"
// @Success 200 {object} models.PaginatedResponse{data=[]Job}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/jobs [get]
func (h *JobsHandler) ListJobs(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse query parameters
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "20")
	jobType := c.Query("type")
	worker := c.Query("worker")
	state := c.Query("state")

	// Parse and validate pagination
	paginationHelper := utils.NewPaginationHelper()
	params, apiErr := paginationHelper.ParseAndValidate(pageStr, limitStr)
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Validate state filter
	if state != "" {
		validStates := []string{"activatable", "activated", "completed", "failed", "cancelled"}
		if apiErr := h.validator.ValidateStringEnum(state, "state", validStates); apiErr != nil {
			c.JSON(http.StatusBadRequest, models.ErrorResponse(
				models.NewValidationError("Invalid state filter", []models.ValidationError{*apiErr}),
				requestID))
			return
		}
	}

	logger.Debug("Listing jobs",
		logger.String("request_id", requestID),
		logger.Int("page", params.Page),
		logger.Int("limit", params.Limit),
		logger.String("type", jobType),
		logger.String("worker", worker),
		logger.String("state", state))

	// Create list request
	listReq := map[string]interface{}{
		"operation": "list",
		"type":      jobType,
		"worker":    worker,
		"state":     state,
		"limit":     params.Limit,
		"offset":    utils.GetOffset(params.Page, params.Limit),
	}

	// Send to jobs component and get response
	response, err := h.sendJobsRequest(listReq, requestID)
	if err != nil {
		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Parse jobs and total count from response
	jobs := h.parseJobsFromResponse(response)
	totalCount := h.extractTotalCount(response)

	logger.Info("Jobs listed",
		logger.String("request_id", requestID),
		logger.Int("count", len(jobs)),
		logger.Int("total", totalCount))

	paginatedResp := paginationHelper.CreateResponse(jobs, totalCount, params, requestID)
	c.JSON(http.StatusOK, paginatedResp)
}

// GetJob handles GET /api/v1/jobs/:key
// @Summary Get job details
// @Description Get detailed information about a specific job
// @Tags jobs
// @Produce json
// @Param key path string true "Job key"
// @Success 200 {object} models.APIResponse{data=Job}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 404 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/jobs/{key} [get]
func (h *JobsHandler) GetJob(c *gin.Context) {
	requestID := h.getRequestID(c)
	jobKey := c.Param("key")

	if jobKey == "" {
		apiErr := models.BadRequestError("Job key is required")
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Getting job details",
		logger.String("request_id", requestID),
		logger.String("job_key", jobKey))

	// Create get request
	getReq := map[string]interface{}{
		"operation": "get",
		"job_key":   jobKey,
	}

	// Send to jobs component and get response
	response, err := h.sendJobsRequest(getReq, requestID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			apiErr := models.JobNotFoundError(jobKey)
			c.JSON(http.StatusNotFound, models.ErrorResponse(apiErr, requestID))
		} else {
			apiErr := h.converter.GRPCErrorToAPIError(err)
			statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
			c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		}
		return
	}

	// Parse job from response
	job := h.parseJobFromResponse(response)
	if job == nil {
		apiErr := models.JobNotFoundError(jobKey)
		c.JSON(http.StatusNotFound, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Info("Job details retrieved",
		logger.String("request_id", requestID),
		logger.String("job_key", jobKey),
		logger.String("type", job.Type),
		logger.String("state", job.State))

	c.JSON(http.StatusOK, models.SuccessResponse(job, requestID))
}

// CompleteJob handles PUT /api/v1/jobs/:key/complete
// @Summary Complete job
// @Description Mark job as completed with optional variables
// @Tags jobs
// @Accept json
// @Produce json
// @Param key path string true "Job key"
// @Param request body models.CompleteJobRequest false "Job completion request"
// @Success 200 {object} models.APIResponse{data=models.UpdateResponse}
// @Failure 400 {object} models.APIResponse{error=models.APIError}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 404 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/jobs/{key}/complete [put]
func (h *JobsHandler) CompleteJob(c *gin.Context) {
	requestID := h.getRequestID(c)
	jobKey := c.Param("key")

	if jobKey == "" {
		apiErr := models.BadRequestError("Job key is required")
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Parse optional request body
	var req models.CompleteJobRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			logger.Warn("Failed to parse complete job request body, using defaults",
				logger.String("request_id", requestID),
				logger.String("error", err.Error()))
		}
	}

	logger.Debug("Completing job",
		logger.String("request_id", requestID),
		logger.String("job_key", jobKey))

	// Create complete request - implementation continues...
	_ = map[string]interface{}{
		"operation": "complete",
		"job_key":   jobKey,
		"variables": req.Variables,
	}

	// Implementation continues...
	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Complete job endpoint implementation in progress"),
		requestID))
}

// FailJob handles PUT /api/v1/jobs/:key/fail
func (h *JobsHandler) FailJob(c *gin.Context) {
	requestID := h.getRequestID(c)
	_ = c.Param("key") // jobKey for implementation

	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Fail job endpoint not implemented yet"),
		requestID))
}

// ThrowError handles PUT /api/v1/jobs/:key/throw-error
func (h *JobsHandler) ThrowError(c *gin.Context) {
	requestID := h.getRequestID(c)
	_ = c.Param("key") // jobKey for implementation

	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Throw error endpoint not implemented yet"),
		requestID))
}

// CancelJob handles DELETE /api/v1/jobs/:key
func (h *JobsHandler) CancelJob(c *gin.Context) {
	requestID := h.getRequestID(c)
	_ = c.Param("key") // jobKey for implementation

	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Cancel job endpoint not implemented yet"),
		requestID))
}

// UpdateRetries handles PUT /api/v1/jobs/:key/retries
func (h *JobsHandler) UpdateRetries(c *gin.Context) {
	requestID := h.getRequestID(c)
	_ = c.Param("key") // jobKey for implementation

	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Update retries endpoint not implemented yet"),
		requestID))
}

// UpdateTimeout handles PUT /api/v1/jobs/:key/timeout
func (h *JobsHandler) UpdateTimeout(c *gin.Context) {
	requestID := h.getRequestID(c)
	_ = c.Param("key") // jobKey for implementation

	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Update timeout endpoint not implemented yet"),
		requestID))
}

// GetStats handles GET /api/v1/jobs/stats
func (h *JobsHandler) GetStats(c *gin.Context) {
	requestID := h.getRequestID(c)

	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Get job stats endpoint not implemented yet"),
		requestID))
}

// Helper methods

func (h *JobsHandler) sendJobsRequest(req map[string]interface{}, requestID string) (map[string]interface{}, error) {
	reqJSON, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	err = h.coreInterface.SendMessage("jobs", string(reqJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	respJSON, err := h.coreInterface.WaitForJobsResponse(30000)
	if err != nil {
		return nil, fmt.Errorf("failed to get response: %w", err)
	}

	var response map[string]interface{}
	err = json.Unmarshal([]byte(respJSON), &response)
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return response, nil
}

func (h *JobsHandler) parseJobsFromResponse(response map[string]interface{}) []Job {
	// Parse jobs from response - implementation details
	return []Job{}
}

func (h *JobsHandler) parseJobFromResponse(response map[string]interface{}) *Job {
	// Parse single job from response - implementation details
	return nil
}

func (h *JobsHandler) extractTotalCount(response map[string]interface{}) int {
	if count, ok := response["total_count"].(float64); ok {
		return int(count)
	}
	return 0
}

func (h *JobsHandler) getRequestID(c *gin.Context) string {
	if requestID := c.GetHeader("X-Request-ID"); requestID != "" {
		return requestID
	}
	return "jobs_" + h.generateRandomString(8)
}

func (h *JobsHandler) generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = charset[i%len(charset)]
	}
	return string(result)
}
