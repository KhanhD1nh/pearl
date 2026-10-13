package legacyrpc

import (
	"net"
	"net/http"
	"testing"
	"time"
)

// iOS reclaims the sockets of a suspended app; the RPC server must accept
// connections again on the same address afterwards, and Stop must not hang.
func TestServerRelistensAfterListenerDies(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := lis.Addr().String()
	s := NewServer(&Options{MaxPOSTClients: 1, MaxWebsocketClients: 1}, nil, []net.Listener{lis})
	s.Start()

	lis.Close() // simulate the OS killing the socket
	var ok bool
	for i := 0; i < 50 && !ok; i++ {
		time.Sleep(100 * time.Millisecond)
		res, err := http.Post("http://"+addr, "application/json", nil)
		if err == nil {
			res.Body.Close()
			ok = true
		}
	}
	if !ok {
		t.Fatal("server did not listen again")
	}

	done := make(chan struct{})
	go func() { s.Stop(); close(done) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Stop hung")
	}
}
