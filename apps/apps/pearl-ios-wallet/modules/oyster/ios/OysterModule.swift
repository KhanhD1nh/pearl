import COyster
import ExpoModulesCore

// Thin bridge to the Go exports in wallet/mobile_ios.go.
private func call(_ f: () -> UnsafeMutablePointer<CChar>?) -> String {
  guard let p = f() else { return "{\"error\":\"null reply\"}" }
  defer { free(p) }
  return String(cString: p)
}

public class OysterModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Oyster")

    Function("dataDir") { () -> String in
      FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("oyster").path
    }

    // wallet.db lives in <dataDir>/<network name>/ (wallet/walletsetup.go networkDir).
    Function("walletExists") { (dataDir: String, network: String) -> Bool in
      FileManager.default.fileExists(atPath: dataDir + "/" + network + "/wallet.db")
    }

    AsyncFunction("create") { (args: String, create: String) -> String in
      call { args.withCString { a in create.withCString { c in OysterCreate(UnsafeMutablePointer(mutating: a), UnsafeMutablePointer(mutating: c)) } } }
    }

    Function("start") { (args: String) -> String in
      call { args.withCString { OysterStart(UnsafeMutablePointer(mutating: $0)) } }
    }

    Function("status") { () -> String in
      call { OysterStatus() }
    }

    // Last `bytes` of a text file (oyster log), for the in-app log screen.
    Function("tail") { (path: String, bytes: Int) -> String in
      guard let h = FileHandle(forReadingAtPath: path) else { return "" }
      defer { try? h.close() }
      let end = h.seekToEndOfFile()
      h.seek(toFileOffset: end > UInt64(bytes) ? end - UInt64(bytes) : 0)
      return String(decoding: h.readDataToEndOfFile(), as: UTF8.self)
    }

    // In-process JSON-RPC (no socket). AsyncFunction runs off the JS thread.
    AsyncFunction("rpc") { (auth: String, body: String) -> String in
      call { auth.withCString { a in body.withCString { b in OysterRPC(UnsafeMutablePointer(mutating: a), UnsafeMutablePointer(mutating: b)) } } }
    }
  }
}
