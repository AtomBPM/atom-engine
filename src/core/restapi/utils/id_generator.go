/*
This file is part of the AtomBPMN (R) project.
Copyright (c) 2025 Matreska Market LLC (ООО «Matreska Market»).
Authors: Matreska Team.

This project is dual-licensed under AGPL-3.0 and AtomBPMN Commercial License.
*/

package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// GenerateSecureRequestID generates a cryptographically secure request ID
func GenerateSecureRequestID(prefix string) string {
	// Generate 6 random bytes (12 hex chars)
	randomBytes := make([]byte, 6)
	if _, err := rand.Read(randomBytes); err != nil {
		// Fallback to timestamp-based ID if crypto/rand fails
		timestamp := time.Now().UnixNano()
		return fmt.Sprintf("%s_%d", prefix, timestamp%1000000)
	}

	randomStr := hex.EncodeToString(randomBytes)
	return fmt.Sprintf("%s_%s", prefix, randomStr)
}

// GenerateSecureRandomString generates a cryptographically secure random string
func GenerateSecureRandomString(length int) string {
	if length <= 0 {
		return ""
	}

	// Generate enough random bytes
	numBytes := (length + 1) / 2 // Each byte gives 2 hex chars
	randomBytes := make([]byte, numBytes)
	if _, err := rand.Read(randomBytes); err != nil {
		// Fallback to timestamp-based string if crypto/rand fails
		timestamp := time.Now().UnixNano()
		fallback := fmt.Sprintf("%d", timestamp)
		if len(fallback) > length {
			return fallback[:length]
		}
		return strings.Repeat(fallback, (length/len(fallback))+1)[:length]
	}

	// Convert to hex and truncate to desired length
	hexStr := hex.EncodeToString(randomBytes)
	if len(hexStr) > length {
		return hexStr[:length]
	}
	return hexStr
}
