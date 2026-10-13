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
	"fmt"
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"
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

// mobileRecover turns a Go panic into an error instead of killing the app.
func mobileRecover(err *error) {
	if r := recover(); r != nil {
		*err = fmt.Errorf("panic: %v\n%s", r, debug.Stack())
	}
}

// mobileStderr sends stdout/stderr (oyster prints errors there) to a file,
// since an iOS app has no console. Read it from the app data dir.
func mobileStderr(args []string) {
	for _, a := range args {
		if dir, ok := strings.CutPrefix(a, "--appdata="); ok {
			_ = os.MkdirAll(dir, 0o700)
			f, err := os.OpenFile(filepath.Join(dir, "stderr.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
			if err == nil {
				os.Stdout, os.Stderr = f, f
			}
		}
	}
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
	mobileStderr(args)
	seed, err := func() (seed string, err error) {
		defer mobileRecover(&err)
		c, _, err := loadConfig()
		if err != nil {
			return "", err
		}
		cfg = c
		if err := checkCreateDir(networkDir(c.AppDataDir.Value, activeNet.Params)); err != nil {
			return "", err
		}
		return createWalletFromJSON(c, []byte(C.GoString(createJSON)))
	}()
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
	mobileStderr(args)
	go func() {
		err := func() (err error) {
			defer mobileRecover(&err)
			return walletMain()
		}()
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
