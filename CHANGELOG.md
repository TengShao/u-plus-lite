# Changelog
### [1.0.1](https://github.com/TengShao/u-plus-lite/compare/v1.0.0...v1.0.1) (2026-04-03)


### Bug Fixes

* add || true after curl to prevent set -e exit on network error ([2ead3ff](https://github.com/TengShao/u-plus-lite/commit/2ead3ff9ee30e5814847deeb6bdd4dc61364a7e7))
* add cascade delete for Workload.user relation ([8dc9aba](https://github.com/TengShao/u-plus-lite/commit/8dc9abacc51f6e72e009979edbbf161e94c6f177))
* remove premature cd before git clone ([e666dac](https://github.com/TengShao/u-plus-lite/commit/e666dacec74f3be8695d2bddcd4b1ab76e27bf29))
* use prod.db instead of dev.db in deploy.ps1 for production database isolation ([2433a7c](https://github.com/TengShao/u-plus-lite/commit/2433a7c5de31049af380ced4482c2e9c83492b98))


### Documentation

* fix deploy command to use -o flag for interactive input support ([13bbaa3](https://github.com/TengShao/u-plus-lite/commit/13bbaa375ae50fdd28d814ab987cc7f3dd6c6664))
* move deploy-guide.md to deploy/ folder ([48d8f08](https://github.com/TengShao/u-plus-lite/commit/48d8f0830378a642b84d36888bbf5bc2156a0f39))
* revert to download-then-run method with explanation ([f27d25b](https://github.com/TengShao/u-plus-lite/commit/f27d25b7b28e69786959e60a4a20a4975f21f10c))
