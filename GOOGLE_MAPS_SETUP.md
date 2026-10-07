# Cấu hình Google Maps và GPS cho CampusNav

Website đã có nút Lấy vị trí hiện tại, lớp đường bao tòa nhà và route A*/Dijkstra. Google Maps cung cấp nền bản đồ/ảnh vệ tinh; browser Geolocation cung cấp vị trí thiết bị.

Website hiện dùng MapLibre + OpenFreeMap mặc định. Hướng dẫn này chỉ áp dụng
khi muốn chuyển sang Google Maps; không cần thực hiện để dùng Leaflet hoặc GPS.

## 1. Tạo project và bật API

1. Mở https://console.cloud.google.com/ bằng tài khoản Google của bạn.
2. Chọn project ở thanh trên cùng → **New Project**. Có thể đặt tên `HaUI Campus Navigation`.
3. Vào **Billing**, liên kết tài khoản thanh toán với project để dùng API key chuẩn. Google Maps tính phí theo mức sử dụng; không mặc định coi mọi request là miễn phí.
4. Vào **APIs & Services → Library**, tìm **Maps JavaScript API** và bấm **Enable**.

Với tính năng hiện tại, chỉ cần Maps JavaScript API. GPS dùng `navigator.geolocation`, còn tìm đường dùng Python của nhóm. Chưa cần bật Geolocation API, Places API, Routes API hay Map Tiles API của Google.

Tài liệu: [Thiết lập Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/get-api-key).

## 2. Tạo và giới hạn API key

1. Vào **APIs & Services → Credentials → Create credentials → API key**. Giao diện Maps Platform cũng có mục **Keys & Credentials**.
2. Mở key vừa tạo. Trong **Application restrictions**, chọn **Websites / HTTP referrers**.
3. Thêm các URL dùng để chạy thử:

```text
http://127.0.0.1:8766/*
http://localhost:8766/*
http://127.0.0.1:8765/*
http://localhost:8765/*
```

4. Trong **API restrictions**, chọn **Restrict key**, rồi chọn **Maps JavaScript API**. Bấm **Save**.
5. Khi triển khai lên domain thật, thêm đúng URL HTTPS, ví dụ `https://campus.example.com/*`.

Maps JavaScript API key được gửi tới trình duyệt để tải Google SDK. Các giới hạn API/referrer bảo vệ phạm vi sử dụng của key; biến môi trường giúp không phải đưa key thật vào source/ZIP.

Tài liệu: [Giới hạn API key](https://developers.google.com/maps/api-security-best-practices).

## 3. Tạo Map ID

1. Vào mục quản lý bản đồ **Google Maps Platform → Maps Management** (có thể hiển thị là Map Management), chọn **Create Map ID**.
2. Đặt tên, chọn loại **JavaScript**, chọn **Vector** cho bản đồ web này và lưu.
3. Sao chép Map ID. Map ID khác API key.

Website dùng Advanced Markers nên cần Map ID. Khi thử nhanh, có thể giữ `DEMO_MAP_ID` đã được code cấu hình sẵn; Map ID riêng phù hợp khi triển khai.

Tài liệu: [Tạo Map ID](https://developers.google.com/maps/documentation/javascript/map-ids/get-map-id), [Advanced Markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/start).

## 4. Đưa key vào website

Có thể lưu cấu hình riêng trên máy: sao chép `maps_config.example.json` thành
`maps_config.local.json`, thay key và Map ID, rồi chạy `run_website.cmd`.
File cấu hình local không được phục vụ trực tiếp qua HTTP hoặc đưa vào ZIP.
Các biến môi trường bên dưới có ưu tiên cao hơn cấu hình local.
Google Maps mở ở chế độ Hybrid mặc định, với mạng đường campus màu vàng và
route xanh sáng có viền, mũi tên chỉ hướng. API key phải giới hạn cho website
local và Maps JavaScript API trước khi sử dụng.

Mở PowerShell trong thư mục repo và chạy:

```powershell
cd .\Shortest-Path-Finding-in-a-Campus-Navigation-System
$env:MAP_PROVIDER = 'google'
$env:GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY'
$env:GOOGLE_MAPS_MAP_ID = 'YOUR_MAP_ID'
python web_server.py --port 8765
```

Thay hai giá trị bằng key và Map ID của project. Nếu thử bằng Map ID demo:

```powershell
$env:GOOGLE_MAPS_MAP_ID = 'DEMO_MAP_ID'
```

Truy cập http://127.0.0.1:8765/ và reload trang. Badge của panel bản đồ phải đổi thành **Google Maps**; nút **Vệ tinh** sẽ được bật. Nút Vệ tinh dùng kiểu hybrid để có ảnh vệ tinh kèm nhãn đường/địa danh.

Nếu cổng 8765 cũng đang được sử dụng, dừng server ở cổng đó bằng Ctrl+C trong terminal đã chạy nó, hoặc chọn cổng khác và thêm URL/cổng đó vào Website restrictions của key.

Biến `$env:` chỉ áp dụng cho terminal hiện tại và server khởi động từ terminal đó. Khi mở terminal mới hoặc nhấp đúp file chạy ở nơi khác, cần cấu hình key lại cho phiên chạy đó.

## 5. Kiểm tra GPS

1. Bật dịch vụ vị trí trên thiết bị.
2. Bấm **Lấy vị trí hiện tại** trên website.
3. Cho phép quyền **Vị trí / Location** khi browser hỏi.
4. Bản đồ hiển thị chấm màu xanh ngọc và vòng sai số do thiết bị trả về. Độ chính xác được hiển thị ở panel trái.
5. Nếu đủ gần campus và tín hiệu đủ chính xác, bấm **Chọn địa điểm gần tôi làm điểm đầu**, sau đó chọn điểm đến và Tìm đường.

Website dùng `getCurrentPosition()` một lần cho mỗi lần bấm, yêu cầu độ chính xác cao, không tự theo dõi liên tục. Trên điện thoại, nguồn vị trí có thể là GPS; trên máy tính có thể là Wi-Fi hoặc định vị mạng nên sai số có thể lớn.

Geolocation cần **HTTPS** và quyền người dùng. `localhost`/`127.0.0.1` trên chính máy chạy browser là ngoại lệ có thể thử với HTTP. Trên điện thoại, `127.0.0.1` trỏ tới điện thoại, không phải máy tính của bạn. Truy cập server bằng IP LAN qua HTTP thường không đủ để dùng GPS; khi kiểm tra bằng điện thoại, cần phục vụ website và backend qua HTTPS.

Tài liệu: [Browser Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).

### Điểm đầu từ GPS trong graph hiện tại

Graph chỉ có các node đã khảo sát, nên GPS được hiển thị riêng và đề xuất một **location gần nhất**. Bản demo chỉ đề xuất khi khoảng cách tới location không quá 100 m và sai số thiết bị không quá 100 m. Đây là ngưỡng ứng dụng, có thể chỉnh trong `js/location.js`.

Tuyến A*/Dijkstra vẫn bắt đầu từ location người dùng xác nhận. Tổng khoảng cách chưa bao gồm đoạn từ GPS thực tới location đó. Website không tự vẽ một đoạn đi bộ xuyên qua tòa nhà/hàng rào để nối GPS vào graph. Khi ở ngoài campus hoặc sai số quá lớn, người dùng chọn điểm đầu thủ công.

Reset xóa vị trí trên giao diện, gợi ý GPS, lựa chọn và kết quả. Tọa độ GPS không được gửi vào API Python tìm đường hoặc lưu trong database của ứng dụng. Khi dùng Google Maps, vị trí được đưa vào Google SDK để hiển thị bản đồ/marker sau thao tác định vị của người dùng.

## 6. Tòa nhà và lộ trình

- **Tòa nhà**: bật/tắt 23 polygon lấy từ OpenStreetMap ngày 07/10/2026 tại vùng campus. Đường bao lấy từ dữ liệu thực, không dựng hình chữ nhật quanh các node. Một số nhãn liên kết với node CSV khi tọa độ node nằm trong polygon.
- Dữ liệu này là một snapshot, không bảo đảm đã bao phủ mọi tòa nhà hoặc khớp tuyệt đối với khảo sát mới nhất. Nhóm nên kiểm tra các nhà C1/C2/C3, C7/C8, KTX... với bản đồ/khuôn viên thực tế.
- **Nhãn**: bật mã địa điểm, còn điểm đầu/đến luôn có nhãn tên.
- **Lộ trình**: nét xanh dày có viền trắng, nổi trên lớp tòa nhà và ảnh vệ tinh; giữ toàn bộ waypoint từ backend.
- **Mạng đường**: lớp graph nền được làm nhạt để phân biệt với tuyến đang chọn.
- Không có key hoặc Internet: lớp tòa nhà, marker và route vẫn hiện trên sơ đồ tọa độ dự phòng.

Source: `data/campus3/buildings.geojson`. Attribution: © OpenStreetMap contributors, ODbL 1.0; https://www.openstreetmap.org/copyright.

## 7. Nếu chưa hiện Google Maps

| Triệu chứng / lỗi | Kiểm tra |
|---|---|
| Badge vẫn là Sơ đồ/OpenStreetMap | Key đã được đặt trong đúng terminal trước khi khởi động server chưa? Reload sau khi restart. |
| `RefererNotAllowedMapError` | URL/cổng đang mở có nằm trong Website restrictions không? `localhost` và `127.0.0.1` là hai host khác nhau. |
| `ApiNotActivatedMapError` | Maps JavaScript API đã Enable trong đúng project chưa? |
| `BillingNotEnabledMapError` | Project đã liên kết billing hợp lệ chưa? |
| `InvalidKeyMapError` | Key có bị thiếu/khoảng trắng/sao chép sai không? |
| Marker không hiện | Map ID phải là JavaScript, đúng project; thử `DEMO_MAP_ID` để đối chiếu. |
| GPS bị từ chối | Kiểm tra quyền Location của website, HTTPS và dịch vụ vị trí trên thiết bị. |

Trong Cloud Console có thể đặt quota để giới hạn số request và budget alert để theo dõi chi phí. Budget alert là thông báo, không tự dừng mọi khoản chi.
