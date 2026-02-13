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

	"github.com/gin-gonic/gin"

	"atom-engine/src/core/logger"
	"atom-engine/src/core/restapi/middleware"
	"atom-engine/src/core/restapi/models"
	"atom-engine/src/core/restapi/utils"
	"atom-engine/src/core/types"
)

// MessagesHandler handles message management HTTP requests
type MessagesHandler struct {
	coreInterface MessagesCoreInterface
	converter     *utils.Converter
	validator     *utils.Validator
}

// MessagesCoreInterface defines methods needed for messages operations
type MessagesCoreInterface interface {
	// JSON Message Routing to messages component
	SendMessage(componentName, messageJSON string) error
	WaitForMessagesResponse(timeoutMs int, requestID string) (string, error)
	GetMessagesComponent() interface{}
	GetMessageStats() (*types.MessageStats, error)
}

// Message data types
type BufferedMessage struct {
	ID             string                 `json:"id"`
	TenantID       string                 `json:"tenant_id"`
	Name           string                 `json:"name"`
	CorrelationKey string                 `json:"correlation_key"`
	Variables      map[string]interface{} `json:"variables"`
	PublishedAt    int64                  `json:"published_at"`
	BufferedAt     int64                  `json:"buffered_at"`
	ExpiresAt      int64                  `json:"expires_at"`
	Reason         string                 `json:"reason"`
}

type MessageSubscription struct {
	ID                   string `json:"id"`
	TenantID             string `json:"tenant_id"`
	ProcessDefinitionKey string `json:"process_definition_key"`
	ProcessVersion       int32  `json:"process_version"`
	StartEventID         string `json:"start_event_id"`
	MessageName          string `json:"message_name"`
	MessageRef           string `json:"message_ref"`
	CorrelationKey       string `json:"correlation_key"`
	IsActive             bool   `json:"is_active"`
	CreatedAt            int64  `json:"created_at"`
	UpdatedAt            int64  `json:"updated_at"`
}

type MessageStats struct {
	TotalMessages         int32 `json:"total_messages"`
	BufferedMessages      int32 `json:"buffered_messages"`
	ExpiredMessages       int32 `json:"expired_messages"`
	PublishedToday        int32 `json:"published_today"`
	InstancesCreatedToday int32 `json:"instances_created_today"`
}

type PublishMessageResponse struct {
	MessageID string `json:"message_id"`
	Matched   bool   `json:"matched"`
	Message   string `json:"message"`
}

type CleanupResponse struct {
	CleanedCount int32  `json:"cleaned_count"`
	Message      string `json:"message"`
}

// NewMessagesHandler creates new messages handler
func NewMessagesHandler(coreInterface MessagesCoreInterface) *MessagesHandler {
	return &MessagesHandler{
		coreInterface: coreInterface,
		converter:     utils.NewConverter(),
		validator:     utils.NewValidator(),
	}
}

// RegisterRoutes registers message routes
func (h *MessagesHandler) RegisterRoutes(router *gin.RouterGroup, authMiddleware *middleware.AuthMiddleware) {
	messages := router.Group("/messages")

	// Apply auth middleware with required permissions
	if authMiddleware != nil {
		messages.Use(authMiddleware.RequirePermission("message"))
	}

	{
		messages.POST("/publish", h.PublishMessage)
		messages.GET("", h.ListBufferedMessages)
		messages.GET("/subscriptions", h.ListSubscriptions)
		messages.GET("/stats", h.GetStats)
		messages.DELETE("/expired", h.CleanupExpired)
		messages.POST("/test", h.TestMessage)
	}
}

// PublishMessage handles POST /api/v1/messages/publish
// @Summary Publish message
// @Description Publish a message for process correlation
// @Tags messages
// @Accept json
// @Produce json
// @Param request body models.PublishMessageRequest true "Message publish request"
// @Success 200 {object} models.APIResponse{data=PublishMessageResponse}
// @Failure 400 {object} models.APIResponse{error=models.APIError}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/messages/publish [post]
func (h *MessagesHandler) PublishMessage(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse request body
	var req models.PublishMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Error("Failed to parse publish message request",
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

	// Additional validations
	validationErrors := h.validator.ValidateMultiple(
		func() *models.ValidationError {
			return h.validator.ValidateRequired(req.MessageName, "message_name")
		},
		func() *models.ValidationError {
			return h.validator.ValidateStringLength(req.MessageName, "message_name", 1, 255)
		},
		func() *models.ValidationError {
			if req.CorrelationKey != "" {
				return h.validator.ValidateStringLength(req.CorrelationKey, "correlation_key", 1, 255)
			}
			return nil
		},
		func() *models.ValidationError {
			if req.TTLSeconds < 0 {
				return &models.ValidationError{
					Field:   "ttl_seconds",
					Value:   req.TTLSeconds,
					Message: "ttl_seconds must be non-negative",
				}
			}
			return nil
		},
	)

	if len(validationErrors) > 0 {
		apiErr := h.validator.CreateValidationError(validationErrors)
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Publishing message",
		logger.String("request_id", requestID),
		logger.String("message_name", req.MessageName),
		logger.String("correlation_key", req.CorrelationKey),
		logger.String("tenant_id", req.TenantID))

	// Create publish request message
	publishReq := map[string]interface{}{
		"type":       "publish_message",
		"request_id": requestID,
		"payload": map[string]interface{}{
			"tenant_id":       req.TenantID,
			"message_name":    req.MessageName,
			"correlation_key": req.CorrelationKey,
			"variables":       req.Variables,
			"ttl_seconds":     req.TTLSeconds,
		},
	}

	// Send to messages component
	response, err := h.sendMessagesRequest(publishReq, requestID)
	if err != nil {
		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Check if publishing was successful
	success, _ := response["success"].(bool)
	if !success {
		errorMsg, _ := response["error"].(string)
		if errorMsg == "" {
			errorMsg = "Message publishing failed"
		}

		logger.Warn("Message publishing failed",
			logger.String("request_id", requestID),
			logger.String("message_name", req.MessageName),
			logger.String("error", errorMsg))

		apiErr := models.NewAPIError(models.ErrorCodeMessageFailed, errorMsg)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Extract message information from response
	messageID, _ := response["message_id"].(string)
	matched, _ := response["matched"].(bool)
	message, _ := response["message"].(string)

	publishResp := &PublishMessageResponse{
		MessageID: messageID,
		Matched:   matched,
		Message:   message,
	}

	logger.Info("Message published successfully",
		logger.String("request_id", requestID),
		logger.String("message_name", req.MessageName),
		logger.String("message_id", messageID),
		logger.Bool("matched", matched))

	c.JSON(http.StatusOK, models.SuccessResponse(publishResp, requestID))
}

// ListBufferedMessages handles GET /api/v1/messages
// @Summary List buffered messages
// @Description Get list of buffered messages with pagination
// @Tags messages
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param tenant_id query string false "Tenant ID filter"
// @Success 200 {object} models.PaginatedResponse{data=[]BufferedMessage}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/messages [get]
func (h *MessagesHandler) ListBufferedMessages(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse query parameters
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "20")
	tenantID := c.Query("tenant_id")

	// Parse and validate pagination
	paginationHelper := utils.NewPaginationHelper()
	params, apiErr := paginationHelper.ParseAndValidate(pageStr, limitStr)
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Listing buffered messages",
		logger.String("request_id", requestID),
		logger.Int("page", params.Page),
		logger.Int("limit", params.Limit),
		logger.String("tenant_id", tenantID))

	// Create list request
	listReq := map[string]interface{}{
		"type":       "list_buffered_messages",
		"request_id": requestID,
		"payload": map[string]interface{}{
			"tenant_id": tenantID,
			"limit":     params.Limit,
			"offset":    utils.GetOffset(params.Page, params.Limit),
		},
	}

	// Send to messages component and get response
	response, err := h.sendMessagesRequest(listReq, requestID)
	if err != nil {
		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Parse messages and total count from response
	messages := h.parseBufferedMessagesFromResponse(response)
	totalCount := h.extractTotalCount(response)

	logger.Info("Buffered messages listed",
		logger.String("request_id", requestID),
		logger.Int("count", len(messages)),
		logger.Int("total", totalCount))

	paginatedResp := paginationHelper.CreateResponse(messages, totalCount, params, requestID)
	c.JSON(http.StatusOK, paginatedResp)
}

// ListSubscriptions handles GET /api/v1/messages/subscriptions
// @Summary List message subscriptions
// @Description Get list of message subscriptions with pagination
// @Tags messages
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param tenant_id query string false "Tenant ID filter"
// @Success 200 {object} models.PaginatedResponse{data=[]MessageSubscription}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/messages/subscriptions [get]
func (h *MessagesHandler) ListSubscriptions(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse query parameters
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "20")
	tenantID := c.Query("tenant_id")

	// Parse and validate pagination
	paginationHelper := utils.NewPaginationHelper()
	params, apiErr := paginationHelper.ParseAndValidate(pageStr, limitStr)
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Listing message subscriptions",
		logger.String("request_id", requestID),
		logger.Int("page", params.Page),
		logger.Int("limit", params.Limit),
		logger.String("tenant_id", tenantID))

	// Create list request
	listReq := map[string]interface{}{
		"type":       "list_subscriptions",
		"request_id": requestID,
		"payload": map[string]interface{}{
			"tenant_id": tenantID,
			"limit":     params.Limit,
			"offset":    utils.GetOffset(params.Page, params.Limit),
		},
	}

	// Send to messages component and get response
	response, err := h.sendMessagesRequest(listReq, requestID)
	if err != nil {
		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Parse subscriptions and total count from response
	subscriptions := h.parseSubscriptionsFromResponse(response)
	totalCount := h.extractTotalCount(response)

	logger.Info("Message subscriptions listed",
		logger.String("request_id", requestID),
		logger.Int("count", len(subscriptions)),
		logger.Int("total", totalCount))

	paginatedResp := paginationHelper.CreateResponse(subscriptions, totalCount, params, requestID)
	c.JSON(http.StatusOK, paginatedResp)
}

// GetStats handles GET /api/v1/messages/stats
// @Summary Get message statistics
// @Description Get message processing statistics
// @Tags messages
// @Produce json
// @Param tenant_id query string false "Tenant ID filter"
// @Success 200 {object} models.APIResponse{data=MessageStats}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/messages/stats [get]
func (h *MessagesHandler) GetStats(c *gin.Context) {
	requestID := h.getRequestID(c)
	tenantID := c.Query("tenant_id")

	logger.Debug("Getting message statistics",
		logger.String("request_id", requestID),
		logger.String("tenant_id", tenantID))

	// Use direct call to GetMessageStats instead of channel-based approach
	typedStats, err := h.coreInterface.GetMessageStats()
	if err != nil {
		logger.Error("Failed to get message statistics",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Convert to handler response format
	stats := &MessageStats{
		TotalMessages:         int32(typedStats.TotalMessages),
		BufferedMessages:      int32(typedStats.BufferedMessages),
		ExpiredMessages:       int32(typedStats.ExpiredMessages),
		PublishedToday:        0, // Not available in new stats
		InstancesCreatedToday: 0, // Not available in new stats
	}

	logger.Info("Message statistics retrieved",
		logger.String("request_id", requestID),
		logger.Any("total_messages", stats.TotalMessages),
		logger.Any("buffered_messages", stats.BufferedMessages))

	c.JSON(http.StatusOK, models.SuccessResponse(stats, requestID))
}

// CleanupExpired handles DELETE /api/v1/messages/expired
// @Summary Cleanup expired messages
// @Description Remove expired buffered messages
// @Tags messages
// @Produce json
// @Param tenant_id query string false "Tenant ID filter"
// @Success 200 {object} models.APIResponse{data=CleanupResponse}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/messages/expired [delete]
func (h *MessagesHandler) CleanupExpired(c *gin.Context) {
	requestID := h.getRequestID(c)
	tenantID := c.Query("tenant_id")

	logger.Debug("Cleaning up expired messages",
		logger.String("request_id", requestID),
		logger.String("tenant_id", tenantID))

	// Create cleanup request
	cleanupReq := map[string]interface{}{
		"type":       "cleanup_expired",
		"request_id": requestID,
		"payload": map[string]interface{}{
			"tenant_id": tenantID,
		},
	}

	// Send to messages component and get response
	response, err := h.sendMessagesRequest(cleanupReq, requestID)
	if err != nil {
		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Parse cleanup result from response
	cleanedCount, _ := response["cleaned_count"].(float64)
	message, _ := response["message"].(string)
	if message == "" {
		message = fmt.Sprintf("Cleaned up %d expired messages", int32(cleanedCount))
	}

	cleanupResp := &CleanupResponse{
		CleanedCount: int32(cleanedCount),
		Message:      message,
	}

	logger.Info("Expired messages cleaned up",
		logger.String("request_id", requestID),
		logger.Any("cleaned_count", int32(cleanedCount)))

	c.JSON(http.StatusOK, models.SuccessResponse(cleanupResp, requestID))
}

// TestMessage handles POST /api/v1/messages/test
// @Summary Test message publishing
// @Description Test message publishing without actual processing
// @Tags messages
// @Accept json
// @Produce json
// @Param request body models.PublishMessageRequest true "Message test request"
// @Success 200 {object} models.APIResponse{data=map[string]interface{}}
// @Failure 400 {object} models.APIResponse{error=models.APIError}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/messages/test [post]
func (h *MessagesHandler) TestMessage(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse request body
	var req models.PublishMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr := models.BadRequestError("Invalid request body: " + err.Error())
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Validate basic fields
	if req.MessageName == "" {
		apiErr := models.BadRequestError("message_name is required")
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Testing message",
		logger.String("request_id", requestID),
		logger.String("message_name", req.MessageName))

	// Create test response
	testResponse := map[string]interface{}{
		"message_name":    req.MessageName,
		"correlation_key": req.CorrelationKey,
		"tenant_id":       req.TenantID,
		"variables_count": len(req.Variables),
		"ttl_seconds":     req.TTLSeconds,
		"test_result":     "Message format is valid",
	}

	logger.Info("Message test completed",
		logger.String("request_id", requestID),
		logger.String("message_name", req.MessageName))

	c.JSON(http.StatusOK, models.SuccessResponse(testResponse, requestID))
}

// Helper methods

func (h *MessagesHandler) sendMessagesRequest(
	req map[string]interface{},
	requestID string,
) (map[string]interface{}, error) {
	reqJSON, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	err = h.coreInterface.SendMessage("messages", string(reqJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	respJSON, err := h.coreInterface.WaitForMessagesResponse(30000, requestID)
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

func (h *MessagesHandler) parseBufferedMessagesFromResponse(response map[string]interface{}) []BufferedMessage {
	result, ok := response["result"]
	if !ok {
		return []BufferedMessage{}
	}

	resultArray, ok := result.([]interface{})
	if !ok {
		return []BufferedMessage{}
	}

	messages := make([]BufferedMessage, 0, len(resultArray))
	for _, item := range resultArray {
		msgMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		msg := BufferedMessage{
			ID:             h.getStringField(msgMap, "id"),
			TenantID:       h.getStringField(msgMap, "tenant_id"),
			Name:           h.getStringField(msgMap, "name"),
			CorrelationKey: h.getStringField(msgMap, "correlation_key"),
			Reason:         h.getStringField(msgMap, "reason"),
		}

		if variables, ok := msgMap["variables"].(map[string]interface{}); ok {
			msg.Variables = variables
		}

		msg.PublishedAt = h.parseTimestamp(msgMap, "published_at")
		msg.BufferedAt = h.parseTimestamp(msgMap, "buffered_at")
		msg.ExpiresAt = h.parseTimestamp(msgMap, "expires_at")

		messages = append(messages, msg)
	}

	return messages
}

func (h *MessagesHandler) parseSubscriptionsFromResponse(response map[string]interface{}) []MessageSubscription {
	result, ok := response["result"]
	if !ok {
		return []MessageSubscription{}
	}

	resultArray, ok := result.([]interface{})
	if !ok {
		return []MessageSubscription{}
	}

	subscriptions := make([]MessageSubscription, 0, len(resultArray))
	for _, item := range resultArray {
		subMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		sub := MessageSubscription{
			ID:                   h.getStringField(subMap, "id"),
			TenantID:             h.getStringField(subMap, "tenant_id"),
			ProcessDefinitionKey: h.getStringField(subMap, "process_definition_key"),
			StartEventID:         h.getStringField(subMap, "start_event_id"),
			MessageName:          h.getStringField(subMap, "message_name"),
			MessageRef:           h.getStringField(subMap, "message_ref"),
			CorrelationKey:       h.getStringField(subMap, "correlation_key"),
		}

		if version, ok := subMap["process_version"].(float64); ok {
			sub.ProcessVersion = int32(version)
		}

		if isActive, ok := subMap["is_active"].(bool); ok {
			sub.IsActive = isActive
		}

		sub.CreatedAt = h.parseTimestamp(subMap, "created_at")
		sub.UpdatedAt = h.parseTimestamp(subMap, "updated_at")

		subscriptions = append(subscriptions, sub)
	}

	return subscriptions
}

func (h *MessagesHandler) parseStatsFromResponse(response map[string]interface{}) *MessageStats {
	// Parse stats from response - implementation details
	return &MessageStats{}
}

func (h *MessagesHandler) extractTotalCount(response map[string]interface{}) int {
	if count, ok := response["total_count"].(float64); ok {
		return int(count)
	}
	return 0
}

func (h *MessagesHandler) getStringField(data map[string]interface{}, field string) string {
	if val, ok := data[field].(string); ok {
		return val
	}
	return ""
}

func (h *MessagesHandler) parseTimestamp(data map[string]interface{}, field string) int64 {
	val, ok := data[field]
	if !ok {
		return 0
	}

	switch v := val.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case string:
		if v == "" {
			return 0
		}
		// Try parsing ISO8601 timestamp
		t, err := utils.ParseISO8601(v)
		if err == nil {
			return t.Unix()
		}
		return 0
	default:
		return 0
	}
}

func (h *MessagesHandler) getRequestID(c *gin.Context) string {
	if requestID := c.GetHeader("X-Request-ID"); requestID != "" {
		return requestID
	}
	return utils.GenerateSecureRequestID("messages")
}
