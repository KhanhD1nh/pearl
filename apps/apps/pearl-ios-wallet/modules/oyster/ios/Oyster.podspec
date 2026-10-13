Pod::Spec.new do |s|
  s.name           = 'Oyster'
  s.version        = '1.0.0'
  s.summary        = 'Embedded oyster SPV wallet'
  s.author         = 'Pearl'
  s.homepage       = 'https://github.com/pearl-research-labs/pearl'
  s.license        = 'ISC'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  # Built by CI (.github/workflows/pearl-ios-wallet.yml) into ios/lib/.
  s.source_files        = '*.swift'
  s.preserve_paths      = 'lib/*', 'cmod/*'
  s.vendored_libraries  = 'lib/liboyster.a', 'lib/libzk_pow_ffi.a', 'lib/libxmss.a'
  s.frameworks          = 'Security', 'CoreFoundation'
  s.libraries           = 'resolv', 'c++'
  s.pod_target_xcconfig = { 'SWIFT_INCLUDE_PATHS' => '$(PODS_TARGET_SRCROOT)/cmod' }
end
