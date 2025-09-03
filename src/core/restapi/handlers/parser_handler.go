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
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"atom-engine/src/core/logger"
	"atom-engine/src/core/restapi/middleware"
	"atom-engine/src/core/restapi/models"
	"atom-engine/src/core/restapi/utils"
)

// ParserHandler handles BPMN parsing HTTP requests
type ParserHandler struct {
	coreInterface ParserCoreInterface
	converter     *utils.Converter
	validator     *utils.Validator
}

// ParserCoreInterface defines methods needed for BPMN operations
type ParserCoreInterface interface {
	// JSON Message Routing to parser component
	SendMessage(componentName, messageJSON string) error
	WaitForParserResponse(timeoutMs int) (string, error)
}

// BPMN response types
type BPMNProcess struct {
	ID           string                 `json:"id"`
	Key          string                 `json:"key"`
	Name         string                 `json:"name"`
	Version      int32                  `json:"version"`
	Description  string                 `json:"description"`
	CreatedAt    int64                  `json:"created_at"`
	UpdatedAt    int64                  `json:"updated_at"`
	ElementCount int32                  `json:"element_count"`
	IsDeployable bool                   `json:"is_deployable"`
	Metadata     map[string]interface{} `json:"metadata"`
}

type BPMNStats struct {
	TotalProcesses   int32            `json:"total_processes"`
	ActiveProcesses  int32            `json:"active_processes"`
	ProcessesByType  map[string]int32 `json:"processes_by_type"`
	TotalElements    int32            `json:"total_elements"`
	ElementsByType   map[string]int32 `json:"elements_by_type"`
	LastParsed       int64            `json:"last_parsed"`
	ParseSuccessRate float64          `json:"parse_success_rate"`
}

// NewParserHandler creates new parser handler
func NewParserHandler(coreInterface ParserCoreInterface) *ParserHandler {
	return &ParserHandler{
		coreInterface: coreInterface,
		converter:     utils.NewConverter(),
		validator:     utils.NewValidator(),
	}
}

// RegisterRoutes registers BPMN routes
func (h *ParserHandler) RegisterRoutes(router *gin.RouterGroup, authMiddleware *middleware.AuthMiddleware) {
	bpmn := router.Group("/bpmn")

	// Apply auth middleware with required permissions
	if authMiddleware != nil {
		bpmn.Use(authMiddleware.RequirePermission("bpmn"))
	}

	{
		bpmn.POST("/parse", h.ParseBPMN)
		bpmn.GET("/processes", h.ListProcesses)
		bpmn.GET("/processes/:key", h.GetProcess)
		bpmn.DELETE("/processes/:id", h.DeleteProcess)
		bpmn.GET("/processes/:key/json", h.GetProcessJSON)
		bpmn.GET("/stats", h.GetStats)
	}
}

// ParseBPMN handles POST /api/v1/bpmn/parse
// @Summary Parse BPMN file
// @Description Parse and store BPMN process definition
// @Tags bpmn
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "BPMN file"
// @Param process_id formData string false "Process ID"
// @Param force formData boolean false "Force overwrite existing process"
// @Success 201 {object} models.APIResponse{data=models.CreateResponse}
// @Failure 400 {object} models.APIResponse{error=models.APIError}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 409 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/bpmn/parse [post]
func (h *ParserHandler) ParseBPMN(c *gin.Context) {
	requestID := h.getRequestID(c)

	logger.Debug("Parsing BPMN file",
		logger.String("request_id", requestID),
		logger.String("client_ip", c.ClientIP()))

	// Parse multipart form
	err := c.Request.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		logger.Error("Failed to parse multipart form",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.BadRequestError("Invalid multipart form data")
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Get BPMN file
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		logger.Error("No BPMN file provided",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.BadRequestError("BPMN file is required")
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}
	defer file.Close()

	// Validate file type
	if !h.isValidBPMNFile(header) {
		apiErr := models.BadRequestError("Invalid file type. Only .bpmn and .xml files are allowed")
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Read file content
	bpmnContent, err := h.readFileContent(file)
	if err != nil {
		logger.Error("Failed to read BPMN file",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.InternalServerError("Failed to read BPMN file")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Get optional parameters
	processID := c.Request.FormValue("process_id")
	forceStr := c.Request.FormValue("force")
	force, _ := strconv.ParseBool(forceStr)

	// Create parse request
	parseReq := map[string]interface{}{
		"operation":    "parse",
		"file_content": bpmnContent,
		"file_name":    header.Filename,
		"process_id":   processID,
		"force":        force,
	}

	// Send to parser component
	reqJSON, err := json.Marshal(parseReq)
	if err != nil {
		logger.Error("Failed to marshal parse request",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.InternalServerError("Failed to process request")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	err = h.coreInterface.SendMessage("parser", string(reqJSON))
	if err != nil {
		logger.Error("Failed to send message to parser",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.InternalServerError("Failed to communicate with parser service")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Wait for response
	respJSON, err := h.coreInterface.WaitForParserResponse(30000) // 30 seconds timeout
	if err != nil {
		logger.Error("Failed to get parser response",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.InternalServerError("Parser service timeout")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Parse response
	var parseResp map[string]interface{}
	err = json.Unmarshal([]byte(respJSON), &parseResp)
	if err != nil {
		logger.Error("Failed to parse parser response",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.InternalServerError("Invalid parser response")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Check if parsing was successful
	success, _ := parseResp["success"].(bool)
	if !success {
		errorMsg, _ := parseResp["error"].(string)
		if errorMsg == "" {
			errorMsg = "BPMN parsing failed"
		}

		logger.Warn("BPMN parsing failed",
			logger.String("request_id", requestID),
			logger.String("error", errorMsg))

		// Determine appropriate error type
		var apiErr *models.APIError
		if strings.Contains(strings.ToLower(errorMsg), "already exists") {
			apiErr = models.ConflictError(errorMsg)
		} else if strings.Contains(strings.ToLower(errorMsg), "invalid") ||
			strings.Contains(strings.ToLower(errorMsg), "validation") {
			apiErr = models.NewAPIError(models.ErrorCodeBPMNValidationError, errorMsg)
		} else {
			apiErr = models.NewAPIError(models.ErrorCodeBPMNParseError, errorMsg)
		}

		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Extract process information from response
	processKey, _ := parseResp["process_key"].(string)
	processName, _ := parseResp["process_name"].(string)
	if processKey == "" {
		processKey = processID
	}

	response := &models.CreateResponse{
		ID:      processKey,
		Message: fmt.Sprintf("BPMN process '%s' parsed successfully", processName),
	}

	logger.Info("BPMN file parsed successfully",
		logger.String("request_id", requestID),
		logger.String("process_key", processKey),
		logger.String("file_name", header.Filename))

	c.JSON(http.StatusCreated, models.SuccessResponse(response, requestID))
}

// ListProcesses handles GET /api/v1/bpmn/processes
// @Summary List BPMN processes
// @Description Get list of all BPMN processes with pagination
// @Tags bpmn
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param tenant_id query string false "Tenant ID filter"
// @Success 200 {object} models.PaginatedResponse{data=[]BPMNProcess}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/bpmn/processes [get]
func (h *ParserHandler) ListProcesses(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse pagination parameters
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "20")
	tenantID := c.Query("tenant_id")

	paginationHelper := utils.NewPaginationHelper()
	params, apiErr := paginationHelper.ParseAndValidate(pageStr, limitStr)
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Listing BPMN processes",
		logger.String("request_id", requestID),
		logger.Int("page", params.Page),
		logger.Int("limit", params.Limit),
		logger.String("tenant_id", tenantID))

	// Create list request
	listReq := map[string]interface{}{
		"operation": "list",
		"page":      params.Page,
		"limit":     params.Limit,
		"tenant_id": tenantID,
	}

	// Send to parser component and get response
	response, err := h.sendParserRequest(listReq, requestID)
	if err != nil {
		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Parse processes from response
	processes := h.parseProcessList(response)
	totalCount := h.extractTotalCount(response)

	logger.Info("BPMN processes listed",
		logger.String("request_id", requestID),
		logger.Int("count", len(processes)),
		logger.Int("total", totalCount))

	paginatedResp := paginationHelper.CreateResponse(processes, totalCount, params, requestID)
	c.JSON(http.StatusOK, paginatedResp)
}

// GetProcess handles GET /api/v1/bpmn/processes/:key
func (h *ParserHandler) GetProcess(c *gin.Context) {
	requestID := h.getRequestID(c)
	processKey := c.Param("key")

	if processKey == "" {
		apiErr := models.BadRequestError("Process key is required")
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Getting BPMN process",
		logger.String("request_id", requestID),
		logger.String("process_key", processKey))

	// Implementation details...
	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Get process endpoint not implemented yet"),
		requestID))
}

// DeleteProcess handles DELETE /api/v1/bpmn/processes/:id
func (h *ParserHandler) DeleteProcess(c *gin.Context) {
	requestID := h.getRequestID(c)
	_ = c.Param("id") // processID for future implementation

	// Implementation details...
	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Delete process endpoint not implemented yet"),
		requestID))
}

// GetProcessJSON handles GET /api/v1/bpmn/processes/:key/json
func (h *ParserHandler) GetProcessJSON(c *gin.Context) {
	requestID := h.getRequestID(c)
	_ = c.Param("key") // processKey for future implementation

	// Implementation details...
	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Get process JSON endpoint not implemented yet"),
		requestID))
}

// GetStats handles GET /api/v1/bpmn/stats
func (h *ParserHandler) GetStats(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Implementation details...
	c.JSON(http.StatusNotImplemented, models.ErrorResponse(
		models.NewAPIError("NOT_IMPLEMENTED", "Get BPMN stats endpoint not implemented yet"),
		requestID))
}

// Helper methods

func (h *ParserHandler) isValidBPMNFile(header *multipart.FileHeader) bool {
	filename := strings.ToLower(header.Filename)
	return strings.HasSuffix(filename, ".bpmn") || strings.HasSuffix(filename, ".xml")
}

func (h *ParserHandler) readFileContent(file multipart.File) (string, error) {
	content, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func (h *ParserHandler) sendParserRequest(req map[string]interface{}, requestID string) (map[string]interface{}, error) {
	reqJSON, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	err = h.coreInterface.SendMessage("parser", string(reqJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	respJSON, err := h.coreInterface.WaitForParserResponse(30000)
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

func (h *ParserHandler) parseProcessList(response map[string]interface{}) []BPMNProcess {
	// Parse processes from response - implementation details
	return []BPMNProcess{}
}

func (h *ParserHandler) extractTotalCount(response map[string]interface{}) int {
	if count, ok := response["total_count"].(float64); ok {
		return int(count)
	}
	return 0
}

func (h *ParserHandler) getRequestID(c *gin.Context) string {
	if requestID := c.GetHeader("X-Request-ID"); requestID != "" {
		return requestID
	}
	return "parser_" + h.generateRandomString(8)
}

func (h *ParserHandler) generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = charset[i%len(charset)]
	}
	return string(result)
}
