# Dữ liệu graph và cách cập nhật

Bộ dữ liệu hiện tại được nhập từ `nodes (2).csv` và `edges (1).csv` ngày
27/10/2026. Nguồn chạy chính nằm trong `haui_astar_project/nodes_project.csv`
và `haui_astar_project/edges_project.csv` với nguyên cấu trúc cột của CSV mới.

## Trạng thái

- 87 node: 44 location, 43 waypoint; 6 node được đánh dấu là điểm rẽ.
- 134 cạnh gốc: 128 cạnh đang mở, 6 cạnh bị khóa.
- Cạnh bị khóa: E006, E015, E058, E062, E087, E092.
- 27 cạnh có needsReview, gồm 23 cạnh đang mở và 4 cạnh đã bị khóa.
- Đồ thị các cạnh đang mở vẫn kết nối đủ 87 node.
- Tuyến N001 → N017 dài 688,20 m, gồm 16 node; dùng đường vòng qua N078
  thay cho cạnh E006 (N002–N038) đã bị khóa.

## Ý nghĩa cột

| Cột | Cách hệ thống sử dụng |
|---|---|
| type | location có thể chọn làm điểm đầu/đích; waypoint vẫn tham gia đường đi |
| displayName | Tên hiển thị; dùng name khi trường này trống |
| showOnMap | Bật/tắt marker của location; không xóa node khỏi đồ thị |
| isTurn | Đánh dấu điểm rẽ trong danh sách waypoint của lộ trình |
| enabled | Chỉ cạnh True được đưa vào đồ thị thuật toán và lớp mạng đường |
| needsReview | Ghi chú cần kiểm tra; không tự khóa cạnh nếu enabled vẫn True |
| reviewReason | Lý do hiển thị tại phần chi tiết đoạn cần kiểm tra của lộ trình |

Boolean từ CSV như True/False được chuyển thành boolean thật, tránh trường
hợp chuỗi "False" bị JavaScript hiểu là có giá trị. Trọng số distance tính bằng mét.
Đồ thị vẫn vô hướng: một cạnh đang mở có thể đi theo hai chiều.

## Nhập CSV mới

Chạy từ thư mục dự án:

```powershell
python sync_graph_data.py --nodes 'nodes (2).csv' --edges 'edges (1).csv'
```

Script kiểm tra ID, tọa độ, trọng số và các tham chiếu trước khi thay dữ liệu.
Sau đó cập nhật hai CSV chính cùng `data/campus3/nodes.json`,
`data/campus3/edges.json` và tâm bản đồ trong `data/campuses.json`.
Hai file CSV đầu vào của người dùng không bị sửa nội dung.

Sau khi sửa trực tiếp CSV chính, tạo lại JSON và kiểm tra bằng:

```powershell
python sync_graph_data.py
python sync_graph_data.py --check
python -m unittest test_graph_data test_web -v
npm test
```

Khởi động lại web_server.py sau khi đổi dữ liệu vì backend nạp graph khi chạy.
Các bản GUI Python cũ dùng chung loader nên cũng chỉ tìm đường trên cạnh đang mở.

## JavaScript

`js/graph.js` cung cấp các quy tắc boolean, tên hiển thị, lọc marker và dựng
adjacency từ cạnh đang mở. `js/astar.js` và `js/dijkstra.js` là ES Modules, có
thể chạy riêng với JSON; website chính tiếp tục gọi thuật toán Python qua API.
`main.js`, `map.js` và `open_map.js` cùng dùng các quy tắc metadata này.

GET /api/graph giữ đủ 134 cạnh và metadata để giao diện đọc trạng thái.
stats.edges là 128 cạnh đang mở; stats.edges_total là 134 cạnh gốc.
Kết quả POST /api/route có path_edges, review_edges và needsReview.
Một tuyến được gắn needsReview vẫn là kết quả hợp lệ trên các cạnh đang mở;
phần kết quả sẽ hiện chi tiết ghi chú từ CSV để nhóm đối chiếu thực địa.
