# Changelog
## [1.1.0](https://github.com/TengShao/u-plus-lite/compare/v1.0.5...v1.1.0) (2026-04-06)


### Features

* 草稿取消时支持暂存或放弃草稿 ([194f33a](https://github.com/TengShao/u-plus-lite/commit/194f33a921217d0a720c2191a8425c0bec068331))
* 改造 LLM 内容解析弹窗交互 ([4beba98](https://github.com/TengShao/u-plus-lite/commit/4beba98a73e0a6949bb77fff57fe9bef6b0baa4c))
* 用户软删除功能 ([a706c83](https://github.com/TengShao/u-plus-lite/commit/a706c8325672000ddcf7ec2388b218bb240efd8a))
* 暂存按钮功能 - 必填项未填完时显示暂存 ([09d7bb3](https://github.com/TengShao/u-plus-lite/commit/09d7bb3cf336f9c57d7670f6d2954cd63feac172))
* add LLM provider settings UI with Ollama/MiniMax switching ([b7b53e5](https://github.com/TengShao/u-plus-lite/commit/b7b53e5545a4c6b6aab54f40bad4e0e77bbba34b))
* add RequirementTags component ([1b48612](https://github.com/TengShao/u-plus-lite/commit/1b486129b18587b768b80e010c002f34f63e5ad2))
* LLM导入需求组草稿机制 ([191738f](https://github.com/TengShao/u-plus-lite/commit/191738f8bd72377fc63b5e25c419fbe9b221f147))


### Bug Fixes

* 409后自动刷新合并，无冲突时直接重试提交 ([4ce6e5d](https://github.com/TengShao/u-plus-lite/commit/4ce6e5d4e2bc4f01c329656c82ca128c59284cf3))
* 草稿刷新消失的问题及草稿交互体验优化 ([28a339e](https://github.com/TengShao/u-plus-lite/commit/28a339e741440fb7e5dbe817c7b52d3aa03dc8a9))
* 筛选器'完成'改为'能否完成' ([24ff6d7](https://github.com/TengShao/u-plus-lite/commit/24ff6d7b95612951027235b7befa57032cb1b281))
* 筛选器状态多选、空名称草稿自动删除 ([fa0d246](https://github.com/TengShao/u-plus-lite/commit/fa0d2466b631652ad6f1e5cadf6cb3e6c5fdf351))
* 删除过时的LLM导入设计文档 + 修正刷新提示文案 ([cbab90a](https://github.com/TengShao/u-plus-lite/commit/cbab90ae475e50f1ddc3ca8a162646a0c87d9392))
* 新建需求组时设置isDraft=true防止刷新后被删除 ([a54462b](https://github.com/TengShao/u-plus-lite/commit/a54462b01342bcbe820fce334f26903a6246f15f))
* 修复草稿刷新后不出现的问题 - loadRequirements里同步保存sessionStorage ([b6e1af0](https://github.com/TengShao/u-plus-lite/commit/b6e1af09d7e1e2a88fdc06a8d40e1bbe1cb367cc))
* 修复提交需求组后其他需求组被误标为待完成的问题 ([e03b169](https://github.com/TengShao/u-plus-lite/commit/e03b169371cb49a98969872e32f81efc1ca1e754))
* 修复暂存后刷新需求组被删除的问题 - 用isDraft判断而非lastSubmittedAt ([d1f674e](https://github.com/TengShao/u-plus-lite/commit/d1f674e8a05701c2e88329800cea091c557b13a1))
* 需求组名称为空时不允许存为草稿 ([fd50c39](https://github.com/TengShao/u-plus-lite/commit/fd50c3985b36932f87bda65586b373e9ef97bc64))
* 暂存后versionRef未更新导致第二次暂存409 ([96bf70c](https://github.com/TengShao/u-plus-lite/commit/96bf70c980f747ca8f8da017e0b68b184f7d7315))
* accept null values in RequirementTags props ([a76c3df](https://github.com/TengShao/u-plus-lite/commit/a76c3df4e05908c15e89bdf34195feca8e660d67))
* handleCreateRequirement同步写入draftExpansionKey sessionStorage防止刷新后草稿消失 ([987f4a1](https://github.com/TengShao/u-plus-lite/commit/987f4a198dbf0e5c8161d804a5442a3c2ce2cbac))
* only show pipeline tag in RequirementTags ([4cc46bc](https://github.com/TengShao/u-plus-lite/commit/4cc46bc0fee708d4efd4ab730e17f151ddc05a16))
* use reasoning_effort=none to disable thinking in Ollama ([3636d8f](https://github.com/TengShao/u-plus-lite/commit/3636d8f0fcd852d8f5310e56cb39eb052a7b814d))


### Documentation

* add RequirementTags component design spec ([8811e2e](https://github.com/TengShao/u-plus-lite/commit/8811e2e29916732ed904db91ab9836621526cb78))


### Refactoring

* extract RequirementTags from RequirementCardCollapsed ([21ff1bc](https://github.com/TengShao/u-plus-lite/commit/21ff1bc1621e18f289cc0ed725f9d013e22bcfeb))
