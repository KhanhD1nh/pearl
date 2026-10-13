// Copyright (c) 2025-2026 The Pearl Research Labs
// Use of this source code is governed by an ISC
// license that can be found in the LICENSE file.

// C entry points for embedding oyster in the iOS app
// (go build -buildmode=c-archive). Every function takes the oyster command
// line flags as a JSON string array and returns a malloc'd JSON string
// {"result": ..., "error": ...} that the caller must free().
//
// ponytail: oyster keeps process globals and runs once per process, so
// OysterStart works only once; switching wallet/network needs an app restart.
// Upgrade path: make walletMain restartable (needs core changes).

package main

/*
#include <stdlib.h>
*/
import "C"

import (
	"encoding/json"
	"errors"
	"os"
	"sync"
)

var (
	mobileMu      sync.Mutex
	mobileStarted bool
	mobileErr     error
)

func mobileReply(result any, err error) *C.char {
	out := map[string]any{"result": result}
	if err != nil {
		out["error"] = err.Error()
	}
	b, _ := json.Marshal(out)
	return C.CString(string(b))
}

func mobileArgs(argsJSON *C.char) ([]string, error) {
	var args []string
	if err := json.Unmarshal([]byte(C.GoString(argsJSON)), &args); err != nil {
		return nil, err
	}
	return append([]string{"oyster"}, args...), nil
}

// OysterCreate creates a wallet like --createfromfile, without exiting the
// process. createJSON uses the createfromfile fields (PrivatePassphrase,
// Seed, Bday). Returns the mnemonic. Must run before OysterStart.
//
//export OysterCreate
func OysterCreate(argsJSON, createJSON *C.char) *C.char {
	mobileMu.Lock()
	defer mobileMu.Unlock()
	if mobileStarted {
		return mobileReply(nil, errors.New("oyster already started"))
	}
	args, err := mobileArgs(argsJSON)
	if err != nil {
		return mobileReply(nil, err)
	}
	os.Args = append(args, "--noinitialload")
	c, _, err := loadConfig()
	if err != nil {
		return mobileReply(nil, err)
	}
	cfg = c
	seed, err := createWalletFromJSON(c, []byte(C.GoString(createJSON)))
	return mobileReply(seed, err)
}

// OysterStart runs oyster in the background. Poll its RPC server for
// readiness and OysterStatus for a startup failure.
//
//export OysterStart
func OysterStart(argsJSON *C.char) *C.char {
	mobileMu.Lock()
	defer mobileMu.Unlock()
	if mobileStarted {
		return mobileReply(nil, errors.New("oyster already started"))
	}
	args, err := mobileArgs(argsJSON)
	if err != nil {
		return mobileReply(nil, err)
	}
	mobileStarted = true
	os.Args = args
	go func() {
		err := walletMain()
		if err == nil {
			err = errors.New("oyster stopped")
		}
		mobileMu.Lock()
		mobileErr = err
		mobileMu.Unlock()
	}()
	return mobileReply(true, nil)
}

// OysterStatus reports whether oyster is running; error is set once it exits.
//
//export OysterStatus
func OysterStatus() *C.char {
	mobileMu.Lock()
	defer mobileMu.Unlock()
	return mobileReply(mobileStarted && mobileErr == nil, mobileErr)
}
