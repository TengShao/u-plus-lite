# Changelog
### [1.0.4](https://github.com/TengShao/u-plus-lite/compare/v1.0.0...v1.0.4) (2026-04-03)


### Features

* add option to reset admin password during update deployment ([32acaaf](https://github.com/TengShao/u-plus-lite/commit/32acaaf6a8a5fcbc99caaed6e503e95a0caa34fd))
* add q to quit at all interactive prompts ([a799457](https://github.com/TengShao/u-plus-lite/commit/a799457ac94fbb22b4cb02aae4df13fc31456364))
* show current version before deployment starts ([1e18ac6](https://github.com/TengShao/u-plus-lite/commit/1e18ac64b5b209ff4865c3b0700fb521c0266708))


### Bug Fixes

* accept both YES and yes for uninstall confirmation ([c89bcd8](https://github.com/TengShao/u-plus-lite/commit/c89bcd8d6828a1c645872be48db85ea679669b41))
* add || true after curl to prevent set -e exit on network error ([2ead3ff](https://github.com/TengShao/u-plus-lite/commit/2ead3ff9ee30e5814847deeb6bdd4dc61364a7e7))
* add cascade delete for Workload.user relation ([8dc9aba](https://github.com/TengShao/u-plus-lite/commit/8dc9abacc51f6e72e009979edbbf161e94c6f177))
* allow retry when invalid path entered for existing deployment ([da20920](https://github.com/TengShao/u-plus-lite/commit/da209206b558c41da1b15a511721e88b06242fd3))
* always create u-plus-lite subdirectory when user specifies custom path ([cdf8416](https://github.com/TengShao/u-plus-lite/commit/cdf8416b41f7f1d75aeac8235f8a44a45c7c2f94))
* change version prompt to '当前最新版本' ([775133d](https://github.com/TengShao/u-plus-lite/commit/775133da09cbb22899e9380087b0a0efa01df0b3))
* clarify default path prompt in deployment scripts ([a2472a4](https://github.com/TengShao/u-plus-lite/commit/a2472a4c377d568dcfc947d01047552f5dc55fe6))
* ensure LATEST_VERSION has fallback value ([2edbf6d](https://github.com/TengShao/u-plus-lite/commit/2edbf6dd199f72f6d759edb4c144eff000ec3c5f))
* fallback to git ls-remote when GitHub API is rate limited ([80a41e5](https://github.com/TengShao/u-plus-lite/commit/80a41e579530245328cf8ce3439709eec33f0a39))
* for existing deployment, search for u-plus-lite subfolder in specified path ([e0d1d09](https://github.com/TengShao/u-plus-lite/commit/e0d1d09788f0976368a157a51e7ce7c3f4eda300))
* prompt for deployment path in new deployment mode ([a5855aa](https://github.com/TengShao/u-plus-lite/commit/a5855aa63c8b24858bb1f045f2d21987314d624e))
* remove git tag dereference suffix ^{} ([a5218c1](https://github.com/TengShao/u-plus-lite/commit/a5218c110c6ff4c5055f60cc94f38847ca5cb70f))
* remove premature cd before git clone ([e666dac](https://github.com/TengShao/u-plus-lite/commit/e666dacec74f3be8695d2bddcd4b1ab76e27bf29))
* set DATABASE_URL before running import.ts in both scripts ([74577c5](https://github.com/TengShao/u-plus-lite/commit/74577c52abf1c7f08b4d6aacccc443ac3a5921cd))
* set DATABASE_URL env before prisma commands in new deployment ([d06e964](https://github.com/TengShao/u-plus-lite/commit/d06e964df03950e7031cb830282a9e93df21ce30))
* set DATABASE_URL env before running seed.ts in new deployment ([0a3e973](https://github.com/TengShao/u-plus-lite/commit/0a3e973dff061bce57bdf1ecdf8f50f7cfa81966))
* show both current and latest version for existing deployments ([a8d1315](https://github.com/TengShao/u-plus-lite/commit/a8d1315db3eab2ecfff5d266f9e0260d96187155))
* show current version right after version check ([e1bc80b](https://github.com/TengShao/u-plus-lite/commit/e1bc80b2a432df883b43312de8d7fc6e180549ee))
* show default path in no deployment found message ([40e4d20](https://github.com/TengShao/u-plus-lite/commit/40e4d2076a50c395164d8407789693fdf47cf744))
* show simple message when already up to date during update ([fb5ad32](https://github.com/TengShao/u-plus-lite/commit/fb5ad3215f0ce95429ec68287a81bd616dfdd1c8))
* show version number instead of text for new deployment ([41bf981](https://github.com/TengShao/u-plus-lite/commit/41bf98154413e64a41542f56bc88a59c4b65ec5c))
* simplify deployment mode menu text ([e2fd30b](https://github.com/TengShao/u-plus-lite/commit/e2fd30bd92c7881a4760dc365a57e295f1b04d22))
* unify default value prompt style ([8f74c0c](https://github.com/TengShao/u-plus-lite/commit/8f74c0ccb43320740f19a00780bd3c829c3a5232))
* update menu text to '指定已部署路径' ([1156e5f](https://github.com/TengShao/u-plus-lite/commit/1156e5fe8fc1784fc71e3e4d5fa635cbf083a765))
* use POSIX read -s for cross-platform password input ([a7a9954](https://github.com/TengShao/u-plus-lite/commit/a7a9954335688096a897490e90217f7deed4da9e))
* use prod.db instead of dev.db in deploy.ps1 for production database isolation ([2433a7c](https://github.com/TengShao/u-plus-lite/commit/2433a7c5de31049af380ced4482c2e9c83492b98))
* 修复更新模式重置管理员密码的 bug ([38fabd9](https://github.com/TengShao/u-plus-lite/commit/38fabd993ba4e3995ac0620d4f759d7eebd02390))
* 完善部署脚本的项目路径自动检测逻辑 ([aa2969b](https://github.com/TengShao/u-plus-lite/commit/aa2969b415af3d7ce223942310d435db13d89e4d))
* 脚本自动检测项目目录，无需用户输入路径 ([b07279e](https://github.com/TengShao/u-plus-lite/commit/b07279eca7710a53a4fa524e44fb6520a027adae))


### Documentation

* fix deploy command to use -o flag for interactive input support ([13bbaa3](https://github.com/TengShao/u-plus-lite/commit/13bbaa375ae50fdd28d814ab987cc7f3dd6c6664))
* move deploy-guide.md to deploy/ folder ([48d8f08](https://github.com/TengShao/u-plus-lite/commit/48d8f0830378a642b84d36888bbf5bc2156a0f39))
* revert to download-then-run method with explanation ([f27d25b](https://github.com/TengShao/u-plus-lite/commit/f27d25b7b28e69786959e60a4a20a4975f21f10c))
* 同步测试指南与部署脚本 ([22e4d36](https://github.com/TengShao/u-plus-lite/commit/22e4d36df014dafa964b32331d824ee4b29e8705))
* 同步部署指南与脚本步骤 ([20fa51c](https://github.com/TengShao/u-plus-lite/commit/20fa51c0ab03632c0c3d830d6c5a77596699b067))
