# Chạy CampusNav với Leaflet + OpenStreetMap

Bản đồ chính hiện là MapLibre + OpenFreeMap miễn phí; xem FREE_MAP_SETUP.md.
Hướng dẫn này dành cho chế độ Leaflet dự phòng, chọn MAP_PROVIDER = leaflet.

## Khởi động

Nhấp đúp `run_website.cmd`, hoặc mở PowerShell:

```powershell
cd .\Shortest-Path-Finding-in-a-Campus-Navigation-System
$env:MAP_PROVIDER = 'leaflet'
python web_server.py --port 8765
```

Mở http://127.0.0.1:8765/. Giữ dòng MAP_PROVIDER để chọn Leaflet.
Không cần tạo tài khoản Google Cloud, API key hay billing.
Nếu cổng bận, dùng `--port 8766` hoặc cổng khác và mở đúng địa chỉ.
Dừng server bằng Ctrl+C trong terminal đã chạy nó.

Không mở trực tiếp index.html hoặc dùng Live Server: website cần API Python
được phục vụ bởi web_server.py. Không cần cài thêm thư viện Python.

## Bản đồ và đường đi

- CSS và JavaScript Leaflet 1.9.4 được lưu trong vendor/leaflet và tải cục bộ.
- Nền OpenStreetMap tải qua Internet. Khi nền không tải được, các lớp tòa nhà,
  mạng đường, marker, GPS và route vẫn hoạt động; giao diện báo lỗi ảnh nền.
- Chọn điểm đầu/đích bằng danh sách hoặc click marker; chọn A* hoặc Dijkstra
  rồi bấm Tìm đường. Python trả về toàn bộ path và waypoint; Leaflet vẽ route.
- Tòa nhà là 23 polygon 2D thật trong data/campus3/buildings.geojson. Tắt/bật
  bằng checkbox Tòa nhà. Đây là đường bao mặt bằng, không phải mô hình 3D.
- Checkbox Mạng đường và Nhãn điều khiển các lớp dữ liệu; nút góc phải trên
  đưa map về toàn bộ khuôn viên. Có zoom và thanh tỷ lệ theo mét.
- Vệ tinh chỉ có khi chủ động chọn chế độ Google Maps; xem GOOGLE_MAPS_SETUP.md.

## GPS

1. Bật dịch vụ vị trí trên thiết bị.
2. Bấm Lấy vị trí hiện tại và cho phép Location khi trình duyệt hỏi.
3. Map hiển thị chấm xanh ngọc và vòng sai số; panel trái ghi độ chính xác.
4. Nếu gần campus và tín hiệu đủ chính xác, bấm Chọn địa điểm gần tôi làm
   điểm đầu. Chọn đích và tìm đường.

GPS được lấy một lần mỗi lần bấm, không theo dõi liên tục. Trên máy tính,
trình duyệt có thể định vị bằng Wi-Fi/mạng; điện thoại có thể dùng GPS.
Browser Geolocation cần HTTPS hoặc localhost/127.0.0.1 trên chính thiết bị.
Muốn dùng điện thoại kết nối tới máy tính, cần phục vụ frontend và API qua
HTTPS; HTTP với IP LAN thường không cho dùng GPS. 127.0.0.1 trên điện thoại
trỏ tới điện thoại, không phải máy tính.

Route bắt đầu từ location đã xác nhận, chưa gồm đoạn GPS tới location.
Ứng dụng gợi ý location khi cách nó không quá 100 m và sai số không quá 100 m.
Ngoài campus hoặc tín hiệu không chính xác, vẫn chọn điểm thủ công được.
Tọa độ định vị ở trong trình duyệt, không gửi tới API tìm đường Python.

## Cấu trúc và kiểm thử

index.html → js/main.js → POST /api/route → route_service.find_route()
→ astar.py/dijkstra.py → JSON path_coordinates → js/map.js → Leaflet.

```powershell
python -m unittest test_web -v
node --test test_location.mjs
```

## Khi ảnh nền không xuất hiện

Nếu map có marker, tòa nhà và route nhưng nền trống, thư viện Leaflet đã chạy;
ảnh nền từ tile.openstreetmap.org chưa tải được. Kiểm tra kết nối Internet và
khả năng truy cập tên miền này, rồi tải lại trang. API key Google không giải
quyết lỗi này. Trong phiên kiểm tra hiện tại, request tới tên miền ảnh nền lỗi
DNS; ứng dụng vẫn hiển thị các lớp dữ liệu campus.

GPS thực tế cần thử trên thiết bị của bạn với dịch vụ vị trí và quyền Location
được bật. Kiểm thử tự động chỉ mô phỏng cảm biến, không đọc vị trí cá nhân.

Thư viện Leaflet: BSD-2-Clause (vendor/leaflet/LICENSE).
Đường bao tòa nhà: OpenStreetMap contributors, ODbL 1.0.
Giữ attribution trên map. Ảnh nền được tải theo viewport bằng trình duyệt;
không đóng gói hoặc tải hàng loạt tile để dùng offline.

Tài liệu: [Leaflet](https://leafletjs.com/reference.html),
[OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/),
[Browser Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).
