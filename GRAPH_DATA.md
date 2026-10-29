# Dữ liệu graph và cách cập nhật

Bộ CSV mới được tích hợp và kiểm tra ngày 29/10/2026. Nguồn chạy chính nằm
trong `haui_astar_project/nodes_project.csv` và
`haui_astar_project/edges_project.csv`. JSON được tải lên cùng đợt được giữ
nguyên nội dung trong `data/imports/2026-10-29/` để đối chiếu; ứng dụng dùng
JSON tại `data/campus3/` được đồng bộ từ CSV.

## Trạng thái

- 155 node: 44 location, 111 waypoint; 77 node được đánh dấu là điểm rẽ.
- 172 cạnh gốc, tất cả đang mở; không có cạnh bị khóa trong bộ hiện tại.
- 29 cạnh đang mở có needsReview; trạng thái này không tự khóa cạnh.
- Đồ thị kết nối đủ 155 node.
- Tuyến N001 → N017 dài 666,10 m, gồm 25 node/24 đoạn; A* duyệt 62 node,
  Dijkstra duyệt 128 node. Tuyến có E024 dài 25,6 m được ghi chú
  “Đoạn nối ngoài đường”.
- ID cạnh và nhiều waypoint đã được đánh lại. Các ID từng bị khóa trong
  bản cũ hiện có thể là cạnh mở với hai đầu khác; không giữ danh sách khóa
  cứng theo ID cũ.
- N028 được hiển thị là “Hồ Nước”, thống nhất với CSV mới.

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
python sync_graph_data.py --nodes 'nodes_new.csv' --edges 'edges_new.csv'
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
Kho mã nguồn này bàn giao website và backend Python; không kèm GUI Tkinter.

## JavaScript

`js/graph.js` cung cấp các quy tắc boolean, tên hiển thị, lọc marker và dựng
adjacency từ cạnh đang mở. `js/astar.js` và `js/dijkstra.js` là ES Modules, có
thể chạy riêng với JSON; website chính tiếp tục gọi thuật toán Python qua API.
`main.js`, `map.js` và `open_map.js` cùng dùng các quy tắc metadata này.

GET /api/graph giữ đủ 172 cạnh và metadata để giao diện đọc trạng thái.
stats.edges và stats.edges_total hiện đều là 172; stats.disabled_edges là 0.
Kết quả POST /api/route có path_edges, review_edges và needsReview.
Một tuyến được gắn needsReview vẫn là kết quả hợp lệ trên các cạnh đang mở;
phần kết quả sẽ hiện chi tiết ghi chú từ CSV để nhóm đối chiếu thực địa.

## So sánh thuật toán

Đã đối chiếu 1.936 cặp địa điểm và 24.025 cặp trên toàn bộ nút: A* và
Dijkstra cho khoảng cách tương đương trên dữ liệu hiện tại. Có 86 cặp địa
điểm có chuỗi nút khác nhau nhưng cùng chi phí; không yêu cầu chuỗi nút
phải giống nhau khi đánh giá tính đúng.

Trọng số làm tròn đến 0,1 m khiến heuristic đường thẳng hiện có một số
ước lượng vượt chi phí thật ở đoạn rất ngắn, lớn nhất quan sát khoảng
0,025315 m. Kiểm tra toàn bộ cặp hiện tại chưa phát hiện sai khoảng cách;
kết quả này không phải chứng minh heuristic luôn nhất quán hoặc chấp nhận
được cho mọi dữ liệu tương lai. Khi thay trọng số hoặc thêm dữ liệu, cần
chạy lại đối chiếu với Dijkstra.

Kiểm thử loại cạnh khóa sử dụng fixture riêng trong Python và JavaScript,
vì bộ dữ liệu mới không có cạnh khóa thực tế.
