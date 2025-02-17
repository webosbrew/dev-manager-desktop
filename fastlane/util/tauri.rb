module Tauri
  module Android
    def self.build(aab: true, apk: true)
      output_args = []
      output_args << "--aab" if aab
      output_args << "--apk" if apk
      Dir.chdir("..") do
        Fastlane::Actions::sh("npm", "run", "tauri", "android", "build", "--", *output_args)
      end
    end
  end
end
