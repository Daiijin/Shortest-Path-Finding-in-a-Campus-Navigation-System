# Dữ liệu JSON được tải vào khi cập nhật

Hai tệp JSON gốc được giữ nguyên nội dung tại đây để đối chiếu. Tệp `edges.json`
ban đầu có tên `data/edges .json`; `nodes.json` ban đầu ở `data/nodes.json`.
Các tệp này là bản đầu vào lưu trữ, không được website nạp trực tiếp.

CSV trong `haui_astar_project` là nguồn chạy chính. JSON tải lên dùng tên
“Hồ tình yêu” cho N028 và đầu cạnh E035, trong khi CSV mới dùng “Hồ Nước”.
Các dữ liệu còn lại tương đương. JSON dùng để chạy ứng dụng tại
`data/campus3/nodes.json` và `data/campus3/edges.json` được tạo lại từ CSV
bằng `python sync_graph_data.py`, nên thống nhất tên “Hồ Nước”.
