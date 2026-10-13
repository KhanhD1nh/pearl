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
      FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("oyster").path
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
  }
}
