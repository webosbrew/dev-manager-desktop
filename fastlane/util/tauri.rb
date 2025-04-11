module Tauri
  module Android
    def self.build(aab: true, apk: true, targets: [], features: [])
      output_args = []
      output_args << "--aab" if aab
      output_args << "--apk" if apk
      targets.each { |target|
        output_args << "--target"
        output_args << target
      }
      unless features.empty?
        output_args << "--features"
        output_args << features.join(",")
      end
      Dir.chdir("..") do
        Fastlane::Actions::sh("npm", "run", "tauri", "android", "build", "--", *output_args)

        project_dir = File.join('src-tauri', 'gen', 'android')

        apk_search_path = File.join(project_dir, '**', 'build', 'outputs', 'apk', '**', '*.apk')
        aab_search_path = File.join(project_dir, '**', 'build', 'outputs', 'bundle', '**', '*.aab')
        output_json_search_path = File.join(project_dir, '**', 'build', 'outputs', 'apk', '**', 'output*.json') # output.json in Android Studio 3 and output-metadata.json in Android Studio 4
        mapping_txt_search_path = File.join(project_dir, '**', 'build', 'outputs', 'mapping', '**', 'mapping.txt')

        # Our apk/aab is now built, but there might actually be multiple ones that were built if a flavor was not specified in a multi-flavor project (e.g. `assembleRelease`)
        # However, we're not interested in unaligned apk's...
        new_apks = Dir[apk_search_path].reject { |path| path =~ /^.*-unaligned.apk$/i }
        new_apks = new_apks.map { |path| File.expand_path(path) }
        new_aabs = Dir[aab_search_path]
        new_aabs = new_aabs.map { |path| File.expand_path(path) }
        new_output_jsons = Dir[output_json_search_path]
        new_output_jsons = new_output_jsons.map { |path| File.expand_path(path) }
        new_mapping_txts = Dir[mapping_txt_search_path]
        new_mapping_txts = new_mapping_txts.map { |path| File.expand_path(path) }

        # We expose all of these new apks and aabs
        Fastlane::Actions.lane_context[:GRADLE_ALL_APK_OUTPUT_PATHS] = new_apks
        Fastlane::Actions.lane_context[:GRADLE_ALL_AAB_OUTPUT_PATHS] = new_aabs
        Fastlane::Actions.lane_context[:GRADLE_ALL_OUTPUT_JSON_OUTPUT_PATHS] = new_output_jsons
        Fastlane::Actions.lane_context[:GRADLE_ALL_MAPPING_TXT_OUTPUT_PATHS] = new_mapping_txts

        # We also take the most recent apk and aab to return as SharedValues::GRADLE_APK_OUTPUT_PATH and SharedValues::GRADLE_AAB_OUTPUT_PATH
        # This is the one that will be relevant for most projects that just build a single build variant (flavor + build type combo).
        # In multi build variants this value is undefined
        last_apk_path = new_apks.sort_by(&File.method(:mtime)).last
        last_aab_path = new_aabs.sort_by(&File.method(:mtime)).last
        last_output_json_path = new_output_jsons.sort_by(&File.method(:mtime)).last
        last_mapping_txt_path = new_mapping_txts.sort_by(&File.method(:mtime)).last
        Fastlane::Actions.lane_context[:GRADLE_APK_OUTPUT_PATH] = File.expand_path(last_apk_path) if last_apk_path
        Fastlane::Actions.lane_context[:GRADLE_AAB_OUTPUT_PATH] = File.expand_path(last_aab_path) if last_aab_path
        Fastlane::Actions.lane_context[:GRADLE_OUTPUT_JSON_OUTPUT_PATH] = File.expand_path(last_output_json_path) if last_output_json_path
        Fastlane::Actions.lane_context[:GRADLE_MAPPING_TXT_OUTPUT_PATH] = File.expand_path(last_mapping_txt_path) if last_mapping_txt_path

        # Give a helpful message in case there were no new apks or aabs. Remember we're only running this code when assembling, in which case we certainly expect there to be an apk or aab
        Fastlane::UI.message('Couldn\'t find any new signed apk files...') if new_apks.empty? && new_aabs.empty?
      end
    end
  end
end
