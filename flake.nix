{
  description = "webOS Dev Manager";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixpkgs-x86-darwin.url = "github:NixOS/nixpkgs/nixpkgs-26.05-darwin";
  };

  outputs =
    {
      nixpkgs,
      nixpkgs-x86-darwin,
      ...
    }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      nixpkgsFor =
        system: if system == "x86_64-darwin" then nixpkgs-x86-darwin else nixpkgs;
      mkBuildInputs =
        pkgs:
        with pkgs;
        [
          openssl
        ]
        ++ lib.optionals stdenv.hostPlatform.isLinux [
          glib-networking
          gsettings-desktop-schemas
          gtk3
          shared-mime-info
          webkitgtk_4_1

          gst_all_1.gstreamer
          gst_all_1.gst-plugins-base
          gst_all_1.gst-plugins-good
        ];
      packageFor =
        system:
        let
          pkgs = import (nixpkgsFor system) { inherit system; };
          packageJson = builtins.fromJSON (builtins.readFile ./package.json);
        in
        pkgs.rustPlatform.buildRustPackage {
          pname = "webos-dev-manager";
          inherit (packageJson) version;

          src = pkgs.lib.cleanSourceWith {
            src = ./.;
            filter =
              path: type:
              let
                name = baseNameOf path;
              in
              !builtins.elem name [
                ".git"
                "dist"
                "flake.lock"
                "flake.nix"
                "node_modules"
                "target"
                "tmp"
              ];
          };

          cargoLock = {
            lockFile = ./Cargo.lock;
            outputHashes = {
              "r2d2-0.8.10" = "sha256-7bWbepxcaLbN0909s46ftHmtDUKrp4RCCKMZG0EiFG4=";
            };
          };

          npmDeps = pkgs.importNpmLock { npmRoot = ./.; };

          nativeBuildInputs =
            with pkgs;
            [
              nodejs_24
              pkg-config
              importNpmLock.npmConfigHook
            ]
            ++ lib.optionals stdenv.hostPlatform.isLinux [
              wrapGAppsHook3
            ];

          buildInputs = mkBuildInputs pkgs;

          preBuild = ''
            npm run ng build
          '';

          cargoBuildFlags = [
            "--package"
            "devman"
          ];

          cargoTestFlags = [
            "--package"
            "devman"
            "--lib"
          ];
          # These tests need Docker SSH fixtures or host networking semantics
          # that are unavailable in a pure Nix build sandbox.
          checkFlags = [
            "--skip"
            "conn_pool::cmd::test"
          ];

          preFixup = pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
            gappsWrapperArgs+=(
              --prefix XDG_DATA_DIRS : "${pkgs.shared-mime-info}/share"
              --set WEBKIT_DISABLE_DMABUF_RENDERER 1
              --set GDK_BACKEND x11
            )
          '';

          meta = {
            description = packageJson.description;
            homepage = packageJson.homepage;
            license = pkgs.lib.licenses.asl20;
            mainProgram = "webos-dev-manager";
            platforms = supportedSystems;
          };
        };
    in
    {
      packages = forAllSystems (
        system:
        let
          package = packageFor system;
        in
        {
          default = package;
          webos-dev-manager = package;
        }
      );

      apps = forAllSystems (
        system:
        let
          package = packageFor system;
        in
        {
          default = {
            type = "app";
            program = "${package}/bin/webos-dev-manager";
            meta = package.meta;
          };
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = import (nixpkgsFor system) { inherit system; };
        in
        {
          default = pkgs.mkShell (
            {
              packages = with pkgs; [
                cargo
                clippy
                nodejs_24
                rustc
                rustfmt
              ];

              nativeBuildInputs = with pkgs; [
                pkg-config
              ];

              buildInputs = mkBuildInputs pkgs;
            }
            // pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
              # WebKitGTK needs the relocated Nix GSettings schemas at runtime.
              shellHook = ''
                export XDG_DATA_DIRS="${pkgs.shared-mime-info}/share:$GSETTINGS_SCHEMAS_PATH''${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}"
              '';

              # Avoid WebKit's GBM/DMABUF path, which is unreliable on some
              # NixOS graphics stacks, and use the X11 backend as this app does.
              WEBKIT_DISABLE_DMABUF_RENDERER = "1";
              GDK_BACKEND = "x11";
              GIO_EXTRA_MODULES = "${pkgs.glib-networking}/lib/gio/modules";
            }
          );
        }
      );
    };
}
