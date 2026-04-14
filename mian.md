此项目用于完成 AP 融合统计召回率功能。

# 创建 pre.py（已实现）
输入测试集地址，使用已有模型预测肿瘤框，输出预测标注与可视化数据包。

测试集图像地址：/home/wenhao/trains/review_datas/1475Single/images/test
原始标注地址：/home/wenhao/trains/review_datas/1475Single/labels/test
报告地址：/home/DataCollection/Project/RadiSmart/metastasis/WB2D/Report
预测标注输出地址：/home/wenhao/trains/prediction/1475single

当前 pre.py 实际输出：
1. data.json（患者列表、图像路径、gt/pred框、报告文本）。
2. pred_txt/*.txt（预测框导出）。
3. stats.csv（若不存在则创建表头）。


# 生成可运行 html 网页（当前实现与目标）
页面分成数据列表、图像显示、统计参数三部分。

## 数据列表

### 已实现
1. 按 PatientId 列表显示。
2. 可点击选中。
3. 默认选中第一个。

### 待实现
1. 有更改未保存的数据高亮。


## 图像显示

### 已实现
1. 并排显示当前数据前面与背面图。
2. 第三列显示 Front Review。
3. 同时显示原始标注与预测标注：
   - 原始标注（gt）为蓝色虚线。
   - 预测标注（pred）为红色实线。
4. 悬浮框或右侧标记时显示编号/置信度；若在 review 里被标为 FN/FP 同步显示提示。
5. 下方显示报告文本。
6. Front Review 中支持 FN 和 FP 高亮。
7. Front Review 中支持 AGG GT 和 AGG PR 聚合框显示。
8. 标记列紧凑排布，超高自动换列。


## 统计参数

### 当前已实现的数据结构（代码真实状态）
当前使用 CSV 存储，不是 JSON 配对结构。

CSV 字段：
1. patient_id
2. tp
3. fn
4. fp
5. fn_idx_front
6. fp_idx_front
7. agg_gt_groups
8. agg_pred_groups
9. updated_at

### 已实现
1. TP/FN/FP 数值输入。
2. FN idx / FP idx 输入（逗号分隔）。
3. AGG GT / AGG PR 输入（JSON数组字符串）。
4. current precision 与 current recall 实时计算。
5. total precision 与 total recall 实时计算。
6. 从 CSV 读取并回填当前病人数据。
7. Save Current 时：
   - 更新前端 state + localStorage。
   - 调用后端 /api/save-csv 覆写 CSV。
8. Download CSV 导出当前前端数据。

### 待实现（与原需求对齐）
1. 将 TP/FN/FP 改为 GT/PR 数组对编辑。
2. 将保存结构改为 JSON（或 CSV+JSON 双写）。
3. 修改未保存提示与保存状态提示。


# 代码部分（已实现）

## 前端
文件：process/apfusion_viewer.html

1. 支持加载 data.json 与 stats.csv。
2. 支持三画布渲染（Front / Back / Front Review）。
3. 支持 hover 命中框和标记，显示连线与高亮，且支持多命中。
4. 支持 precision/recall 四指标显示。
5. 支持保存按钮调用后端覆写 CSV。

## 后端
文件：process/server.py

1. POST /api/save-csv：接收 records 并写入 csv_path（覆写）。
2. GET /api/health：健康检查。
3. 服务绑定 0.0.0.0，支持局域网访问。


# 交互

## 1. 已实现
1. 所有标注框和标记之间的连线，仅在鼠标悬浮在标注框和标记上时显示。
2. 悬浮时标记高亮。
3. 若鼠标同时命中多个标注框，则全部显示。

## 2. 待实现（GT/PR 数组对选中）
1. 将 TP/FN/FP 换成模式按钮（单选）。
2. 进入模式后显示：已保存配对列表、当前草稿配对（GT/PR）、对应高亮。
3. 左键点击标记或框时执行选中/取消选中：
   - 点击预测框切换 GT 索引。
   - 点击原始框切换 PR 索引。
4. 提供草稿操作：确认配对、清空草稿、删除配对。
5. 模式约束：
   - TP：GT 非空且 PR 非空。
   - FN：GT 为空且 PR 非空。
   - FP：GT 非空且 PR 为空。
6. 去重与冲突处理：
   - 索引去重并升序。
   - 若索引已被其它配对占用，提示迁移或取消。
7. 保存规则：
   - 保存时写入 JSON（或与 CSV 同步，待最终确认）。



