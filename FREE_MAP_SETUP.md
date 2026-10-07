# Bản đồ miễn phí cho CampusNav

## Chạy

Nhấp đúp run_website.cmd hoặc chạy:

```powershell
python web_server.py --port 8765
```

Mở http://127.0.0.1:8765/. Bản đồ mặc định dùng MapLibre + OpenFreeMap,
không cần tài khoản, API key, thẻ thanh toán hoặc Google Billing.
Nếu từng đặt biến môi trường Google, chọn rõ trong cùng terminal:

```powershell
$env:MAP_PROVIDER = 'openfreemap'
python web_server.py --port 8765
```

Không cần tạo maps_config.local.json để dùng OpenFreeMap mặc định.
Key Google cũ chỉ được giữ trong file local; API không gửi key này khi dùng
provider miễn phí và frontend không tải SDK Google trong chế độ này.
File local không được chia sẻ trong ZIP hoặc phục vụ trực tiếp qua HTTP.

## Cách dùng

- Chế độ 2D: nền đường phố chi tiết, tòa nhà, nhãn đường, mặt nước và các vùng
  phủ có trong dữ liệu OpenStreetMap/OpenFreeMap.
- Chế độ 3D: nghiêng bản đồ, dựng khối tòa nhà theo dữ liệu OpenFreeMap. Đây
  là mô hình khối, không phải ảnh vệ tinh hay mô hình quang trắc Google Earth.
  Khi dùng dữ liệu campus local thiếu chiều cao, các khối minh họa dùng 8 m.
- Nút mở rộng ở góc tiêu đề map: xem bản đồ lớn; bấm lại hoặc Esc để thu nhỏ.
- Chọn điểm trên map hoặc tìm trong danh sách; A*/Dijkstra tiếp tục tính ở
  backend Python. Route xanh có viền trắng và mũi tên chỉ chiều di chuyển.
- GPS và vòng sai số vẫn dùng Browser Geolocation; phải được người dùng cho
  phép. Trên điện thoại cần HTTPS, localhost chỉ áp dụng trên chính thiết bị.

## Khi mất mạng

Dự án có bản đồ campus local từ OpenStreetMap: 87 đường, một vùng campus,
một vùng sử dụng đất, 4 vùng thể thao, một hồ, và 23 đường bao tòa nhà.
Không tải hàng loạt tile. Dữ liệu geometry được lấy một lần qua Overpass.
MapLibre giữ tuyến, GPS và marker khi chuyển sang nền campus local.
Thiết bị không hỗ trợ WebGL sẽ chuyển sang Leaflet.

Một số đường chưa được OSM khảo sát đầy đủ; route A*/Dijkstra vẫn dựa vào
nodes_project.csv/edges_project.csv của nhóm, không suy ra từ ảnh nền.
Thời gian, khoảng cách và số node duyệt lấy trực tiếp từ backend.

## Nguồn và giới hạn

[OpenFreeMap](https://openfreemap.org/) cho phép dùng public instance miễn phí,
không đăng ký và không API key. Dịch vụ không cung cấp SLA; dữ liệu OSM có thể
thiếu hoặc cũ ở một số khu vực. Giữ attribution trên bản đồ.

[MapLibre](https://maplibre.org/maplibre-gl-js/docs/) là thư viện mã nguồn mở;
license được lưu trong vendor/maplibre/LICENSE.txt.
Dữ liệu campus OpenStreetMap: ODbL 1.0, metadata trong các file GeoJSON.

Ảnh vệ tinh miễn phí như [EOxCloudless](https://cloudless.eox.at/pricing) được
phép dùng cho dự án học tập phi thương mại nhưng có độ phân giải 10 m, không
phù hợp để nhìn rõ các lối đi nhỏ trong campus. Vì vậy bản hiện tại ưu tiên
đường phố vector và mô hình khối 3D.

## Kiểm thử

```powershell
python -m unittest test_web -v
node --test test_location.mjs
```

Frontend: js/main.js → js/open_map.js; API: GET /api/graph, /api/buildings,
/api/basemap, /api/config và POST /api/route. Dữ liệu tìm đường không thay đổi.
