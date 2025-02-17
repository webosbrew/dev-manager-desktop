module NPM
  def self.run(command, *args)
    pid = Process.spawn("npm", "--prefix", "..", "run", command, "--", *args)
    _, status = Process.wait2(pid)
    raise "npm failed with status #{status}" if status != 0
  end
end
