/*
This file is part of the AtomBPMN (R) project.
Copyright (c) 2025 Matreska Market LLC (ООО «Matreska Market»).
Authors: Matreska Team.

This project is dual-licensed under AGPL-3.0 and AtomBPMN Commercial License.
*/

package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"

	"atom-engine/proto/process/processpb"
	"atom-engine/src/core/logger"
	"atom-engine/src/core/restapi/middleware"
	"atom-engine/src/core/restapi/models"
	"atom-engine/src/core/restapi/utils"
)

// TokensHandler handles token management HTTP requests
type TokensHandler struct {
	coreInterface TokensCoreInterface
	converter     *utils.Converter
	validator     *utils.Validator
}

// TokensCoreInterface defines methods needed for tokens operations
type TokensCoreInterface interface {
	// gRPC connection for direct calls
	GetGRPCConnection() (interface{}, error)
}

// TokenInfo represents token information for REST API
type TokenInfo struct {
	ID                string                 `json:"id"`
	ProcessInstanceID string                 `json:"process_instance_id"`
	ProcessKey        string                 `json:"process_key"`
	CurrentElementID  string                 `json:"current_element_id"`
	State             string                 `json:"state"`
	WaitingFor        string                 `json:"waiting_for,omitempty"`
	CreatedAt         int64                  `json:"created_at"`
	UpdatedAt         int64                  `json:"updated_at"`
	Variables         map[string]interface{} `json:"variables,omitempty"`
}

// NewTokensHandler creates new tokens handler
func NewTokensHandler(coreInterface TokensCoreInterface) *TokensHandler {
	return &TokensHandler{
		coreInterface: coreInterface,
		converter:     utils.NewConverter(),
		validator:     utils.NewValidator(),
	}
}

// RegisterRoutes registers token routes
func (h *TokensHandler) RegisterRoutes(router *gin.RouterGroup, authMiddleware *middleware.AuthMiddleware) {
	tokens := router.Group("/tokens")

	// Apply auth middleware with required permissions
	if authMiddleware != nil {
		tokens.Use(authMiddleware.RequirePermission("token"))
	}

	{
		tokens.GET("", h.ListTokens)
		tokens.GET("/:id", h.GetTokenStatus)
	}
}

// GetTokenStatus handles GET /api/v1/tokens/:id
// @Summary Get token status
// @Description Get detailed information about a specific token
// @Tags tokens
// @Produce json
// @Param id path string true "Token ID"
// @Success 200 {object} models.APIResponse{data=TokenInfo}
// @Failure 400 {object} models.APIResponse{error=models.APIError}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 404 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/tokens/{id} [get]
func (h *TokensHandler) GetTokenStatus(c *gin.Context) {
	requestID := h.getRequestID(c)
	tokenID := c.Param("id")

	if tokenID == "" {
		apiErr := models.BadRequestError("Token ID is required")
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Getting token status",
		logger.String("request_id", requestID),
		logger.String("token_id", tokenID))

	// Get gRPC client
	client, conn, err := h.getProcessGRPCClient()
	if err != nil {
		logger.Error("Failed to get Process gRPC client",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.InternalServerError("Process service not available")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}
	defer conn.Close()

	// Create gRPC context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Call gRPC GetTokenStatus method
	grpcReq := &processpb.GetTokenStatusRequest{
		TokenId: tokenID,
	}

	resp, err := client.GetTokenStatus(ctx, grpcReq)
	if err != nil {
		logger.Error("Failed to get token status via gRPC",
			logger.String("request_id", requestID),
			logger.String("token_id", tokenID),
			logger.String("error", err.Error()))

		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Check if operation succeeded
	if !resp.Success {
		message := "Token not found"
		if resp.Message != "" {
			message = resp.Message
		}
		apiErr := models.NotFoundError(message)
		c.JSON(http.StatusNotFound, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Convert gRPC token to REST API format
	token := &TokenInfo{
		ID:                resp.Token.TokenId,
		ProcessInstanceID: resp.Token.ProcessInstanceId,
		ProcessKey:        resp.Token.ProcessKey,
		CurrentElementID:  resp.Token.CurrentElementId,
		State:             resp.Token.State,
		WaitingFor:        resp.Token.WaitingFor,
		CreatedAt:         resp.Token.CreatedAt,
		UpdatedAt:         resp.Token.UpdatedAt,
	}

	// Convert variables from map[string]string to map[string]interface{}
	if resp.Token.Variables != nil {
		token.Variables = make(map[string]interface{})
		for k, v := range resp.Token.Variables {
			token.Variables[k] = v
		}
	}

	logger.Info("Token status retrieved",
		logger.String("request_id", requestID),
		logger.String("token_id", tokenID),
		logger.String("state", token.State))

	c.JSON(http.StatusOK, models.SuccessResponse(token, requestID))
}

// ListTokens handles GET /api/v1/tokens
// @Summary List tokens
// @Description Get list of tokens with filtering and pagination
// @Tags tokens
// @Produce json
// @Param instance_id query string false "Filter by process instance ID"
// @Param state query string false "Filter by state (ACTIVE, COMPLETED, CANCELLED)"
// @Param page query int false "Page number (default: 1)"
// @Param limit query int false "Items per page (default: 20)"
// @Param sort_by query string false "Sort field (default: created_at)"
// @Param sort_order query string false "Sort order: ASC or DESC (default: DESC)"
// @Success 200 {object} models.APIResponse{data=[]TokenInfo}
// @Failure 400 {object} models.APIResponse{error=models.APIError}
// @Failure 401 {object} models.APIResponse{error=models.APIError}
// @Failure 403 {object} models.APIResponse{error=models.APIError}
// @Failure 500 {object} models.APIResponse{error=models.APIError}
// @Security ApiKeyAuth
// @Router /api/v1/tokens [get]
func (h *TokensHandler) ListTokens(c *gin.Context) {
	requestID := h.getRequestID(c)

	// Parse query parameters
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "20")
	instanceID := c.Query("instance_id")
	stateFilter := c.Query("state")
	sortBy := c.DefaultQuery("sort_by", "created_at")
	sortOrder := c.DefaultQuery("sort_order", "DESC")

	// Parse and validate pagination
	paginationHelper := utils.NewPaginationHelper()
	params, apiErr := paginationHelper.ParseAndValidate(pageStr, limitStr)
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(apiErr, requestID))
		return
	}

	logger.Debug("Listing tokens",
		logger.String("request_id", requestID),
		logger.String("instance_id", instanceID),
		logger.String("state", stateFilter),
		logger.Int("page", params.Page),
		logger.Int("limit", params.Limit))

	// Get gRPC client
	client, conn, err := h.getProcessGRPCClient()
	if err != nil {
		logger.Error("Failed to get Process gRPC client",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := models.InternalServerError("Process service not available")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}
	defer conn.Close()

	// Create gRPC context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Call gRPC ListTokens method
	grpcReq := &processpb.ListTokensRequest{
		InstanceIdFilter: instanceID,
		StateFilter:      stateFilter,
		Page:             int32(params.Page),
		PageSize:         int32(params.Limit),
		SortBy:           sortBy,
		SortOrder:        sortOrder,
	}

	resp, err := client.ListTokens(ctx, grpcReq)
	if err != nil {
		logger.Error("Failed to list tokens via gRPC",
			logger.String("request_id", requestID),
			logger.String("error", err.Error()))

		apiErr := h.converter.GRPCErrorToAPIError(err)
		statusCode := models.HTTPStatusFromErrorCode(apiErr.Code)
		c.JSON(statusCode, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Check if operation succeeded
	if !resp.Success {
		message := "Failed to list tokens"
		if resp.Message != "" {
			message = resp.Message
		}
		apiErr := models.InternalServerError(message)
		c.JSON(http.StatusInternalServerError, models.ErrorResponse(apiErr, requestID))
		return
	}

	// Convert gRPC tokens to REST API format
	tokens := make([]TokenInfo, 0, len(resp.Tokens))
	for _, t := range resp.Tokens {
		token := TokenInfo{
			ID:                t.TokenId,
			ProcessInstanceID: t.ProcessInstanceId,
			ProcessKey:        t.ProcessKey,
			CurrentElementID:  t.CurrentElementId,
			State:             t.State,
			WaitingFor:        t.WaitingFor,
			CreatedAt:         t.CreatedAt,
			UpdatedAt:         t.UpdatedAt,
		}

		// Convert variables from map[string]string to map[string]interface{}
		if t.Variables != nil {
			token.Variables = make(map[string]interface{})
			for k, v := range t.Variables {
				token.Variables[k] = v
			}
		}

		tokens = append(tokens, token)
	}

	// Build response with pagination
	result := map[string]interface{}{
		"data": tokens,
		"pagination": map[string]interface{}{
			"page":       resp.Page,
			"limit":      resp.PageSize,
			"total":      resp.TotalCount,
			"pages":      resp.TotalPages,
			"has_next":   resp.Page < resp.TotalPages,
			"has_prev":   resp.Page > 1,
		},
	}

	logger.Info("Tokens listed",
		logger.String("request_id", requestID),
		logger.Int("count", len(tokens)),
		logger.Int("total", int(resp.TotalCount)))

	c.JSON(http.StatusOK, models.SuccessResponse(result, requestID))
}

// Helper methods

func (h *TokensHandler) getProcessGRPCClient() (processpb.ProcessServiceClient, *grpc.ClientConn, error) {
	conn, err := h.coreInterface.GetGRPCConnection()
	if err != nil {
		return nil, nil, err
	}

	grpcConn, ok := conn.(*grpc.ClientConn)
	if !ok {
		return nil, nil, fmt.Errorf("invalid gRPC connection type")
	}

	client := processpb.NewProcessServiceClient(grpcConn)
	return client, grpcConn, nil
}

func (h *TokensHandler) getRequestID(c *gin.Context) string {
	if requestID := c.GetHeader("X-Request-ID"); requestID != "" {
		return requestID
	}
	return utils.GenerateSecureRequestID("tokens")
}
