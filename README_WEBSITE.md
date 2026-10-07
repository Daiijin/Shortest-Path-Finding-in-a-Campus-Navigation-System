# CampusNav — Website và backend Python

## Chạy trên máy

Nhấp đúp `run_website.cmd`. File chạy mở trình duyệt và giữ terminal để phục vụ API. Hoặc mở terminal tại thư mục dự án:

```powershell
python web_server.py
```

Truy cập `http://127.0.0.1:8765`. Nếu cổng đã được dùng:

```powershell
python web_server.py --port 8766
```

Python 3.10+ là đủ; backend dùng thư viện chuẩn nên không cần cài Flask/FastAPI. File chạy kiểm tra `py`, `python`, rồi Python đi kèm Codex. Dừng server bằng Ctrl+C.

**Chạy website qua server này để có API Python.** Live Server hoặc mở trực tiếp `index.html` sẽ không chạy được phần tìm đường.

## Tính năng

- Giao diện website trên desktop, tablet và điện thoại.
- Dropdown tìm kiếm 44 địa điểm theo tên, từ khóa không dấu hoặc ID.
- Chọn điểm bằng marker; đổi Điểm đầu/Điểm đến bằng chế độ lựa chọn; nút đảo hai điểm.
- Chọn A* hoặc Dijkstra, gọi backend Python và hiển thị kết quả thật.
- Khoảng cách (m), số node đã duyệt, thời gian thuật toán (ms), số node trên tuyến, danh sách điểm đi qua.
- Toàn bộ waypoint trong `path` đều được vẽ trên bản đồ. Tùy chọn Hiện điểm trung gian chỉ thay đổi danh sách kết quả.
- Đặt lại lựa chọn, route và kết quả; thuật toán về A*. Thay đổi điểm/thuật toán sẽ hủy yêu cầu cũ và xóa kết quả cũ.
- Xử lý thiếu/sai địa điểm, start = goal, không có đường, lỗi backend và yêu cầu quá thời gian.

## Bản đồ miễn phí MapLibre + OpenFreeMap (mặc định)

Phiên bản hiện tại dùng OpenFreeMap, không cần đăng ký, API key hoặc thanh toán.
Có chế độ 2D/3D và nền campus lưu trên máy để dùng khi mất mạng.
Xem `FREE_MAP_SETUP.md` để chạy và tìm hiểu nguồn dữ liệu.

## Leaflet + OpenStreetMap (dự phòng)

Chạy server là dùng được bản đồ, không cần Google API key hoặc billing. Leaflet
1.9.4 được lưu tại `vendor/leaflet`: CSS và JavaScript tải từ server của dự án;
ảnh nền tải trực tiếp từ OpenStreetMap qua Internet.

Nếu có `maps_config.local.json`, server đọc provider/key/Map ID từ file này.
Biến môi trường có ưu tiên cao hơn. File local không được phục vụ qua HTTP
hoặc đưa vào ZIP; xem mẫu `maps_config.example.json`.

Nếu muốn dùng Leaflet, chạy `$env:MAP_PROVIDER = 'leaflet'` trước khi khởi động
server. Chế độ miễn phí mặc định là `openfreemap`.

Đã có GPS, 23 đường bao tòa nhà 2D, marker địa điểm, route xanh có viền trắng,
phóng to/thu nhỏ, thanh tỷ lệ, vừa khung campus và bật/tắt lớp bản đồ. Khi ảnh nền
bị lỗi mạng, Leaflet giữ các lớp dữ liệu này và hiển thị thông báo. Nếu thư viện
không khởi tạo được, website dùng sơ đồ tọa độ dự phòng.

Hướng dẫn chạy và GPS: `LEAFLET_SETUP.md`. Thư viện được phân phối theo BSD-2-Clause;
giữ `vendor/leaflet/LICENSE`. Dữ liệu/nền bản đồ có ghi công OpenStreetMap.

## Google Maps (tùy chọn)

Hướng dẫn từng bước cấu hình key, Map ID và GPS: `GOOGLE_MAPS_SETUP.md`.

Đã có nút **Lấy vị trí hiện tại**, vòng sai số và gợi ý địa điểm gần nhất làm điểm đầu. GPS được lấy một lần theo thao tác người dùng; route vẫn tính từ location được xác nhận, chưa tính đoạn từ GPS tới location. Khi triển khai/test điện thoại cần HTTPS.

Lớp **Tòa nhà** vẽ 23 đường bao thật từ OpenStreetMap, được lưu trong `data/campus3/buildings.geojson` và cung cấp qua `GET /api/buildings`. Lớp này hoạt động với Google Maps, Leaflet và sơ đồ offline. Route xanh có viền trắng, nằm trên lớp tòa nhà; mạng đường nền được làm nhạt.

Website chỉ dùng **Maps JavaScript API** và Advanced Markers khi chọn rõ provider
`google` và đã cấu hình API key. Không cần Map Tiles API cho phiên bản website.

1. Trong Google Cloud, tạo project, bật **Maps JavaScript API**, bật billing và tạo API key.
2. Giới hạn key cho Maps JavaScript API và HTTP referrer của website, ví dụ `http://127.0.0.1:8765/*` hoặc đúng domain triển khai.
3. Cấu hình biến môi trường trong cùng terminal rồi chạy server:

```powershell
$env:MAP_PROVIDER = 'google'
$env:GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY'
python web_server.py
```

Nếu dùng cổng 8766, đổi referrer tương ứng và chạy `python web_server.py --port 8766`.

API key của Maps JavaScript được gửi cho trình duyệt để Google SDK tải bản đồ, nên cần giới hạn key như trên. Không đưa key thật vào mã nguồn hoặc gói ZIP.

Đối với map ID, demo dùng `DEMO_MAP_ID`. Khi triển khai, tạo map ID của project và đặt:

```powershell
$env:GOOGLE_MAPS_MAP_ID = 'YOUR_MAP_ID'
```

Khi Google Maps hoạt động, có thể chuyển Bản đồ/Vệ tinh. A*/Dijkstra của nhóm vẫn tính đường trên graph campus; Google cung cấp phần nền bản đồ. Website không gọi Google Routes để thay thế thuật toán của nhóm.

Tài liệu chính thức: [Thiết lập Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/get-api-key), [Advanced Markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/start).

Chưa có API key: dùng Leaflet/OpenStreetMap. Sơ đồ dự phòng vẫn có đường bao tòa
nhà từ GeoJSON; ảnh vệ tinh chỉ có ở chế độ Google Maps.

## Kiến trúc kết nối

```text
Trình duyệt (HTML + CSS + JavaScript)
    GET /api/graph       → node/edge lấy từ graph Python
    GET /api/config      → cấu hình bản đồ
    POST /api/route      → route_service.find_route(start, goal, algorithm)
                          → astar.py / dijkstra.py
                          → JSON kết quả
```

Frontend và API cùng origin, do `web_server.py` phục vụ. Backend nạp `nodes_project.csv` và `edges_project.csv`, dùng graph chung cho cả hai thuật toán. Website không chạy các bản thuật toán JavaScript cũ trong thư mục `js`.

| File | Vai trò |
|---|---|
| `index.html` | Bố cục website, điều khiển, map và results |
| `css/style.css` | Giao diện và responsive |
| `js/main.js` | Picker, validation, gọi API, trạng thái, kết quả |
| `js/map.js` | Google Maps, Leaflet, sơ đồ dự phòng, marker/route |
| `js/open_map.js` | MapLibre, OpenFreeMap, bản đồ campus local, 2D/3D |
| `js/api.js` | Giao tiếp HTTP/JSON |
| `js/location.js` | Browser Geolocation, độ chính xác và gợi ý location gần nhất |
| `data/campus3/buildings.geojson` | Polygon tòa nhà công khai từ OpenStreetMap, ODbL |
| `data/campus3/basemap.geojson` | Đường, hồ, vùng campus và sân thể thao OSM local |
| `web_server.py` | API và phục vụ website |
| `haui_astar_project/route_service.py` | Hàm tích hợp với thuật toán hiện có |
| `test_web.py` | Kiểm thử HTTP và tính nhất quán với backend |

## API tìm đường

```http
POST /api/route
Content-Type: application/json
```

```json
{
  "start": "N001",
  "goal": "N017",
  "algorithm": "astar"
}
```

`algorithm` nhận `astar` hoặc `dijkstra`. Start/goal phải là location trong graph, không phải waypoint.

Kết quả giữ các field của backend: `algorithm`, `start`, `goal`, `path`, `distance`, `visited_nodes`, `execution_time`, `path_names`. API bổ sung `found` và `path_coordinates` với đầy đủ tọa độ của từng node trong path.

- `distance`: mét; `execution_time`: giây. Frontend nhân 1000 để hiển thị ms.
- Start = goal: `found: true`, path một node, khoảng cách 0.
- Không có đường: HTTP 200, `found: false`, path rỗng, distance null, vẫn có metrics.
- Đầu vào sai: HTTP 400, JSON `{ "error": { "code": "invalid_request", "message": "..." } }`.
- `GET /api/health`: kiểm tra backend đang chạy.

`get_nodes()` phân loại tên `Routing Node NN` thành waypoint vì CSV hiện chưa có cột loại node. Nếu nhóm đổi schema/quy ước tên, cập nhật tại `route_service.py`.

## Kiểm thử và đóng gói

```powershell
python -m unittest test_web -v
node --test test_location.mjs
```

Kiểm thử API: graph/dataset, hai thuật toán khớp backend gốc trên nhiều cặp, path có đầy đủ waypoint/tọa độ, start = goal, không có đường, đầu vào sai/JSON lỗi, cấu hình bản đồ và tài nguyên website.

Server mặc định chạy demo local trên `127.0.0.1`. Bộ `Campus_Navigation_Website.zip` chứa frontend, API, backend thuật toán, dataset, test và file chạy để chia sẻ với nhóm.

Thời gian ở Results là một lần chạy thuật toán. Khi đánh giá A* với Dijkstra cho báo cáo, dùng nhiều lần chạy và cùng cặp điểm như `compare_algorithms.py`.
