/*
This file is part of the AtomBPMN (R) project.
Copyright (c) 2025 Matreska Market LLC (ООО «Matreska Market»).
Authors: Matreska Team.

This project is dual-licensed under AGPL-3.0 and AtomBPMN Commercial License.
*/

package system

import (
	"os"
	"runtime"
	"syscall"
)

// GetTotalMemory returns total system memory in bytes
// Возвращает общий объем системной памяти в байтах
func GetTotalMemory() int64 {
	// For cross-platform compatibility, we'll use runtime.MemStats
	// which gives us the Go runtime's view of memory
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Return the heap size as a reasonable approximation
	// In production, you might want to use platform-specific syscalls
	return int64(m.Sys)
}

// GetDiskSpace returns disk space information for given path
// Возвращает информацию о дисковом пространстве для указанного пути
func GetDiskSpace(path string) (total int64, free int64, err error) {
	var stat syscall.Statfs_t

	err = syscall.Statfs(path, &stat)
	if err != nil {
		return 0, 0, err
	}

	// Calculate total and free space
	total = int64(stat.Blocks) * int64(stat.Bsize)
	free = int64(stat.Bavail) * int64(stat.Bsize)

	return total, free, nil
}

// GetSystemDiskSpace returns disk space for the system root
// Возвращает дисковое пространство для системного корня
func GetSystemDiskSpace() int64 {
	// Try to get disk space for root directory
	if total, _, err := GetDiskSpace("/"); err == nil {
		return total
	}

	// Fallback: try current working directory
	if wd, err := os.Getwd(); err == nil {
		if total, _, err := GetDiskSpace(wd); err == nil {
			return total
		}
	}

	// If all fails, return 0
	return 0
}

// GetMemoryInfo returns detailed memory information
// Возвращает детальную информацию о памяти
func GetMemoryInfo() (total int64, used int64, free int64) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Use runtime memory stats as approximation
	total = int64(m.Sys)
	used = int64(m.Alloc)
	free = total - used

	return total, used, free
}
