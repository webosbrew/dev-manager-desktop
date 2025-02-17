module TauriDevServer
  def self.run
    package_name = CredentialsManager::AppfileConfig.try_fetch_value(:package_name)
    envfile = Dir::Tmpname.create(%w[studio- .env]) {}
    env = {
      "PATH" => "#{File.join(Dir.getwd, 'studio')}#{File::PATH_SEPARATOR}#{ENV["PATH"]}",
      "XDG_DATA_HOME" => File.join(Dir.getwd, 'studio'),
      "STUDIO_ENVFILE" => envfile,
    }

    pid = Process.spawn(env, "npm", "--prefix", "..", "run", "tauri", "android", "dev", "--", "--open",
                        [:out, :err] => FastlaneCore::Globals.verbose? ? :out : File::NULL,
                        Gem.win_platform? ? :new_pgroup : :pgroup => true)
    loop do
      begin
        pid = nil
        raise 'dev server exited'
      end if Process.waitpid(pid, Process::WNOHANG)
      break if is_dev_server_running?(package_name) and File.exist?(envfile)
      sleep 1
    end
    yield read_envfile(envfile)
  ensure
    File.delete(envfile) if File.exist?(envfile)
    kill_process_tree(pid) if pid
  end

  class << self
    private

    def read_envfile(file)
      env = {}
      File.readlines(file, chomp: true).each do |line|
        env[$1] = $2 if line =~ /\A([^=]+)=(.*)\z/
      end
      env
    end

    def is_dev_server_running?(package_name)
      begin
        addr = File.read(File.join(Dir.tmpdir, "#{package_name}-server-addr")).split(':')
        TCPSocket.new(addr[0], addr[1].to_i, :connect_timeout => 1)
        return true
      rescue
        return false
      end
    end

    def kill_process_tree(pid)
      if Gem.win_platform?
        system("taskkill /F /T /PID #{pid}", [:out, :err] => File::NULL)
      else
        Process.kill(:SIGTERM, -pid)
      end
      Process.wait(pid)
    end
  end

end
