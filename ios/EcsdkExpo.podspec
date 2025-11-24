Pod::Spec.new do |s|
  s.name           = 'EcsdkExpo'
  s.version        = '1.0.0'
  s.summary        = 'A sample project summary'
  s.description    = 'A sample project description'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  repo_url = "https://github.com/ELERTS/ELERTSKit-iOS"

  spm_dependency(s,
    url: repo_url,
    requirement: { kind: 'upToNextMajorVersion', minimumVersion: '3.0.0' },
    products: ['ELERTSKitCore', 'ELERTSKitUI']
  )

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
