{
  description = "vantion — Effect v4 monorepo";

  # Pinned to the same nixpkgs revision as flake.lock. Bump both together with
  # `nix flake update`; the package set below must exist in the pinned rev.
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/b62d2a9";
  };

  outputs =
    { nixpkgs, ... }:
    let
      forAllSystems =
        function:
        nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed (
          system: function nixpkgs.legacyPackages.${system}
        );
    in
    {
      formatter = forAllSystems (pkgs: pkgs.alejandra);

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            bun
            postgresql
            git
          ];

          shellHook = ''
            echo "vantion dev shell"
            echo "  bun     $(bun --version)"
            echo "  psql    $(psql --version | cut -d' ' -f3)"
            echo ""
            echo "  postgres server: docker compose up -d"
            echo ""
            echo "  nixpkgs pins bun for this shell; .bun-version is what CI and"
            echo "  a non-nix machine read. Keep the two within a minor of each other."
          '';
        };
      });
    };
}
