//go:build !ios

package main

import "github.com/pearl-research-labs/pearl/wallet/rpc/legacyrpc"

// Only the iOS embedding (mobile_ios.go) calls RPC in-process.
func setLegacyRPCServer(*legacyrpc.Server) {}
