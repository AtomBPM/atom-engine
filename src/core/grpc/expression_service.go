/*
This file is part of the AtomBPMN (R) project.
Copyright (c) 2025 Matreska Market LLC (ООО «Matreska Market»).
Authors: Matreska Team.

This project is dual-licensed under AGPL-3.0 and AtomBPMN Commercial License.
*/

package grpc

import (
	"context"
	"encoding/json"
	"fmt"

	"atom-engine/proto/expression/expressionpb"
	"atom-engine/src/core/logger"
	"atom-engine/src/expression"
)

// expressionServiceServer implements expression gRPC service
type expressionServiceServer struct {
	expressionpb.UnimplementedExpressionServiceServer
	core CoreInterface
}

// getExpressionComponent helper function to get expression component with type assertion
func getExpressionComponent(core CoreInterface) (*expression.Component, error) {
	componentIf := core.GetExpressionComponent()
	if componentIf == nil {
		return nil, fmt.Errorf("expression component not available")
	}

	component, ok := componentIf.(*expression.Component)
	if !ok {
		return nil, fmt.Errorf("expression component type assertion failed")
	}

	return component, nil
}

// EvaluateExpression evaluates a FEEL expression
func (s *expressionServiceServer) EvaluateExpression(ctx context.Context, req *expressionpb.EvaluateExpressionRequest) (*expressionpb.EvaluateExpressionResponse, error) {
	logger.Info("EvaluateExpression request",
		logger.String("expression", req.Expression),
		logger.String("context", req.Context))

	// Get expression component
	expressionComp, err := getExpressionComponent(s.core)
	if err != nil {
		return &expressionpb.EvaluateExpressionResponse{
			Success:      false,
			ErrorMessage: err.Error(),
		}, nil
	}

	// Parse context JSON to variables map
	variables := make(map[string]interface{})
	if req.Context != "" {
		if err := json.Unmarshal([]byte(req.Context), &variables); err != nil {
			logger.Warn("Failed to parse context JSON",
				logger.String("context", req.Context),
				logger.String("error", err.Error()))
			return &expressionpb.EvaluateExpressionResponse{
				Success:      false,
				ErrorMessage: "invalid context JSON: " + err.Error(),
			}, nil
		}
	}

	// Evaluate expression
	result, err := expressionComp.EvaluateExpression(req.Expression, variables)
	if err != nil {
		logger.Error("Failed to evaluate expression",
			logger.String("expression", req.Expression),
			logger.String("error", err.Error()))
		return &expressionpb.EvaluateExpressionResponse{
			Success:      false,
			ErrorMessage: err.Error(),
		}, nil
	}

	// Convert result to JSON string
	resultJSON, err := json.Marshal(result)
	if err != nil {
		logger.Error("Failed to marshal result",
			logger.Any("result", result),
			logger.String("error", err.Error()))
		return &expressionpb.EvaluateExpressionResponse{
			Success:      false,
			ErrorMessage: "failed to marshal result: " + err.Error(),
		}, nil
	}

	// Determine result type
	resultType := "string"
	switch result.(type) {
	case bool:
		resultType = "boolean"
	case int, int32, int64, float32, float64:
		resultType = "number"
	case map[string]interface{}:
		resultType = "object"
	case []interface{}:
		resultType = "array"
	case nil:
		resultType = "null"
	}

	logger.Info("Expression evaluated successfully",
		logger.String("expression", req.Expression),
		logger.String("result_type", resultType))

	return &expressionpb.EvaluateExpressionResponse{
		Result:     string(resultJSON),
		Success:    true,
		ResultType: resultType,
	}, nil
}

// ValidateExpression validates expression syntax
func (s *expressionServiceServer) ValidateExpression(ctx context.Context, req *expressionpb.ValidateExpressionRequest) (*expressionpb.ValidateExpressionResponse, error) {
	logger.Info("ValidateExpression request",
		logger.String("expression", req.Expression),
		logger.String("context_schema", req.ContextSchema))

	// Get expression component
	expressionComp, err := getExpressionComponent(s.core)
	if err != nil {
		return &expressionpb.ValidateExpressionResponse{
			Valid:        false,
			ErrorMessage: err.Error(),
		}, nil
	}

	// Try to evaluate expression with empty context to validate syntax
	emptyVars := make(map[string]interface{})
	_, evalErr := expressionComp.EvaluateExpression(req.Expression, emptyVars)

	if evalErr != nil {
		logger.Warn("Expression validation failed",
			logger.String("expression", req.Expression),
			logger.String("error", evalErr.Error()))
		return &expressionpb.ValidateExpressionResponse{
			Valid:        false,
			ErrorMessage: evalErr.Error(),
		}, nil
	}

	logger.Info("Expression validated successfully",
		logger.String("expression", req.Expression))

	return &expressionpb.ValidateExpressionResponse{
		Valid: true,
	}, nil
}

// ParseExpression parses expression and returns AST
func (s *expressionServiceServer) ParseExpression(ctx context.Context, req *expressionpb.ParseExpressionRequest) (*expressionpb.ParseExpressionResponse, error) {
	logger.Info("ParseExpression request",
		logger.String("expression", req.Expression))

	// Get expression component
	expressionComp, err := getExpressionComponent(s.core)
	if err != nil {
		return &expressionpb.ParseExpressionResponse{
			Success:      false,
			ErrorMessage: err.Error(),
		}, nil
	}

	// For now, we don't have AST parsing, so we validate and extract variables
	emptyVars := make(map[string]interface{})
	_, evalErr := expressionComp.EvaluateExpression(req.Expression, emptyVars)

	if evalErr != nil {
		logger.Warn("Expression parsing failed",
			logger.String("expression", req.Expression),
			logger.String("error", evalErr.Error()))
		return &expressionpb.ParseExpressionResponse{
			Success:      false,
			ErrorMessage: evalErr.Error(),
		}, nil
	}

	// Create mock AST structure
	ast := map[string]interface{}{
		"type":       "expression",
		"expression": req.Expression,
		"valid":      true,
	}

	astJSON, err := json.Marshal(ast)
	if err != nil {
		return &expressionpb.ParseExpressionResponse{
			Success:      false,
			ErrorMessage: "failed to create AST",
		}, nil
	}

	logger.Info("Expression parsed successfully",
		logger.String("expression", req.Expression))

	return &expressionpb.ParseExpressionResponse{
		Ast:     string(astJSON),
		Success: true,
	}, nil
}

// GetSupportedFunctions returns list of supported functions
func (s *expressionServiceServer) GetSupportedFunctions(ctx context.Context, req *expressionpb.GetSupportedFunctionsRequest) (*expressionpb.GetSupportedFunctionsResponse, error) {
	logger.Info("GetSupportedFunctions request",
		logger.String("category", req.Category))

	// Create list of supported functions
	functions := []*expressionpb.FunctionInfo{
		{
			Name:        "upper",
			Category:    "string",
			Description: "Convert string to uppercase",
			ReturnType:  "string",
			Examples:    []string{"upper(\"hello\")", "upper(name)"},
			Parameters: []*expressionpb.ParameterInfo{
				{Name: "text", Type: "string", Required: true, Description: "String to convert"},
			},
		},
		{
			Name:        "lower",
			Category:    "string",
			Description: "Convert string to lowercase",
			ReturnType:  "string",
			Examples:    []string{"lower(\"HELLO\")", "lower(name)"},
			Parameters: []*expressionpb.ParameterInfo{
				{Name: "text", Type: "string", Required: true, Description: "String to convert"},
			},
		},
		{
			Name:        "length",
			Category:    "string",
			Description: "Get length of string or array",
			ReturnType:  "number",
			Examples:    []string{"length(\"hello\")", "length(items)"},
			Parameters: []*expressionpb.ParameterInfo{
				{Name: "value", Type: "string|array", Required: true, Description: "String or array to measure"},
			},
		},
		{
			Name:        "add",
			Category:    "numeric",
			Description: "Add two numbers",
			ReturnType:  "number",
			Examples:    []string{"add(5, 3)", "add(price, tax)"},
			Parameters: []*expressionpb.ParameterInfo{
				{Name: "a", Type: "number", Required: true, Description: "First number"},
				{Name: "b", Type: "number", Required: true, Description: "Second number"},
			},
		},
		{
			Name:        "and",
			Category:    "boolean",
			Description: "Logical AND operation",
			ReturnType:  "boolean",
			Examples:    []string{"and(true, false)", "and(x > 5, y < 10)"},
			Parameters: []*expressionpb.ParameterInfo{
				{Name: "a", Type: "boolean", Required: true, Description: "First boolean"},
				{Name: "b", Type: "boolean", Required: true, Description: "Second boolean"},
			},
		},
		{
			Name:        "count",
			Category:    "list",
			Description: "Count elements in array",
			ReturnType:  "number",
			Examples:    []string{"count([1,2,3])", "count(items)"},
			Parameters: []*expressionpb.ParameterInfo{
				{Name: "list", Type: "array", Required: true, Description: "Array to count"},
			},
		},
		{
			Name:        "now",
			Category:    "date",
			Description: "Get current date and time",
			ReturnType:  "date",
			Examples:    []string{"now()", "now() + duration(\"P1D\")"},
		},
	}

	// Filter by category if specified
	if req.Category != "" {
		filteredFunctions := make([]*expressionpb.FunctionInfo, 0)
		for _, fn := range functions {
			if fn.Category == req.Category {
				filteredFunctions = append(filteredFunctions, fn)
			}
		}
		functions = filteredFunctions
	}

	logger.Info("Supported functions retrieved",
		logger.String("category", req.Category),
		logger.Int("function_count", len(functions)))

	return &expressionpb.GetSupportedFunctionsResponse{
		Functions: functions,
	}, nil
}

// TestExpression tests expression with sample data
func (s *expressionServiceServer) TestExpression(ctx context.Context, req *expressionpb.TestExpressionRequest) (*expressionpb.TestExpressionResponse, error) {
	logger.Info("TestExpression request",
		logger.String("expression", req.Expression),
		logger.Int("test_cases_count", len(req.TestCases)))

	// Get expression component
	expressionComp, err := getExpressionComponent(s.core)
	if err != nil {
		return &expressionpb.TestExpressionResponse{
			AllPassed: false,
			Summary:   err.Error(),
		}, nil
	}

	results := make([]*expressionpb.TestResult, 0, len(req.TestCases))
	allPassed := true

	for _, testCase := range req.TestCases {
		// Parse test case context
		variables := make(map[string]interface{})
		if testCase.Context != "" {
			if err := json.Unmarshal([]byte(testCase.Context), &variables); err != nil {
				results = append(results, &expressionpb.TestResult{
					TestName:     testCase.Name,
					Passed:       false,
					ErrorMessage: "invalid context JSON: " + err.Error(),
				})
				allPassed = false
				continue
			}
		}

		// Evaluate expression
		result, err := expressionComp.EvaluateExpression(req.Expression, variables)
		if err != nil {
			results = append(results, &expressionpb.TestResult{
				TestName:     testCase.Name,
				Passed:       false,
				ErrorMessage: err.Error(),
			})
			allPassed = false
			continue
		}

		// Convert result to JSON
		resultJSON, err := json.Marshal(result)
		if err != nil {
			results = append(results, &expressionpb.TestResult{
				TestName:     testCase.Name,
				Passed:       false,
				ErrorMessage: "failed to marshal result",
			})
			allPassed = false
			continue
		}

		actualResult := string(resultJSON)
		passed := actualResult == testCase.ExpectedResult

		if !passed {
			allPassed = false
		}

		results = append(results, &expressionpb.TestResult{
			TestName:       testCase.Name,
			Passed:         passed,
			ActualResult:   actualResult,
			ExpectedResult: testCase.ExpectedResult,
		})
	}

	summary := fmt.Sprintf("Executed %d test cases, %d passed, %d failed",
		len(req.TestCases),
		len(req.TestCases)-len(results)+countPassedTests(results),
		countFailedTests(results))

	logger.Info("Expression tests completed",
		logger.String("expression", req.Expression),
		logger.Bool("all_passed", allPassed),
		logger.String("summary", summary))

	return &expressionpb.TestExpressionResponse{
		Results:   results,
		AllPassed: allPassed,
		Summary:   summary,
	}, nil
}

// Helper methods
func countPassedTests(results []*expressionpb.TestResult) int {
	count := 0
	for _, result := range results {
		if result.Passed {
			count++
		}
	}
	return count
}

func countFailedTests(results []*expressionpb.TestResult) int {
	count := 0
	for _, result := range results {
		if !result.Passed {
			count++
		}
	}
	return count
}

// Other methods with stub implementations for now

func (s *expressionServiceServer) EvaluateBatch(ctx context.Context, req *expressionpb.EvaluateBatchRequest) (*expressionpb.EvaluateBatchResponse, error) {
	return &expressionpb.EvaluateBatchResponse{
		Success:      false,
		ErrorMessage: "batch evaluation not implemented yet",
	}, nil
}

func (s *expressionServiceServer) EvaluateCondition(ctx context.Context, req *expressionpb.EvaluateConditionRequest) (*expressionpb.EvaluateConditionResponse, error) {
	// Get expression component
	expressionComp, err := getExpressionComponent(s.core)
	if err != nil {
		return &expressionpb.EvaluateConditionResponse{
			Success:      false,
			ErrorMessage: err.Error(),
		}, nil
	}

	// Parse context JSON to variables map
	variables := make(map[string]interface{})
	if req.Context != "" {
		if parseErr := json.Unmarshal([]byte(req.Context), &variables); parseErr != nil {
			return &expressionpb.EvaluateConditionResponse{
				Success:      false,
				ErrorMessage: "invalid context JSON: " + parseErr.Error(),
			}, nil
		}
	}

	// Evaluate condition
	result, evalErr := expressionComp.EvaluateCondition(variables, req.Condition)
	if evalErr != nil {
		return &expressionpb.EvaluateConditionResponse{
			Success:      false,
			ErrorMessage: evalErr.Error(),
		}, nil
	}

	return &expressionpb.EvaluateConditionResponse{
		Result:  result,
		Success: true,
	}, nil
}

func (s *expressionServiceServer) ExtractVariables(ctx context.Context, req *expressionpb.ExtractVariablesRequest) (*expressionpb.ExtractVariablesResponse, error) {
	return &expressionpb.ExtractVariablesResponse{
		Success:      false,
		ErrorMessage: "variable extraction not implemented yet",
	}, nil
}
