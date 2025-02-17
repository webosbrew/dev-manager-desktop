module NPM
  def self.run(command, *args)
    Dir.chdir("..") do
      Fastlane::Actions::sh("npm", "run", command, "--", *args)
    end
  end
end
