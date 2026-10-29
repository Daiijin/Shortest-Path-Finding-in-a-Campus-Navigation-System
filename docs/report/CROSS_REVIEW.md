# Kiểm tra chéo cập nhật dữ liệu và báo cáo

Ngày kiểm tra: 29/10/2026. Nền mã nguồn trước cập nhật: `47c0c06`.

## Thay đổi và quyết định

- Tích hợp CSV người dùng đã sửa: 155 nút (44 địa điểm, 111 waypoint),
  77 điểm rẽ, 172 cạnh mở, 0 cạnh khóa và 29 cạnh cần kiểm tra.
- Tạo lại JSON tại đường dẫn ứng dụng đang dùng bằng `sync_graph_data.py`.
- Giữ nguyên JSON tải lên trong `data/imports/2026-10-29/`; tên N028 và đầu
  cạnh E035 trong bản tải lên khác CSV. CSV là nguồn chính, tên chạy là “Hồ Nước”.
- Cập nhật assertion dữ liệu thực. Giữ kiểm thử loại cạnh khóa bằng fixture
  riêng trong cả Python và JavaScript, không dùng danh sách ID khóa cũ.
- Kiểm tra toàn bộ cặp địa điểm bao gồm tính hợp lệ mỗi đoạn và tổng chi phí.
  Cho phép hai thuật toán chọn chuỗi nút khác nhau nếu cùng chi phí tối ưu.
- Chương 3, Chương 4, kết luận, bảng thực nghiệm và ảnh được cập nhật theo
  phiên bản kho này. Không mô tả Tkinter như một thành phần của kho hiện tại.

## Các lượt kiểm tra độc lập

Sub-agent dữ liệu kiểm tra schema, JSON/CSV, tính liên thông, heuristic và
24.025 cặp nút. Sub-agent mã nguồn kiểm tra luồng đồng bộ/API/JavaScript và
rà soát lại diff sau sửa. Sub-agent báo cáo đối chiếu các phát biểu với dữ
liệu và mã nguồn; một lượt rà soát báo cáo cuối xác nhận bảng, số đo, mã
SHA-256, URL clone và phạm vi kiểm thử phù hợp. Không còn phát hiện chặn
trong các thay đổi tích hợp đã rà soát.

## Minh chứng kiểm thử

```text
python sync_graph_data.py --check
  155 nodes, 172 edges, 172 enabled, 0 disabled
python -m unittest test_graph_data -v
  4 passed
python -m unittest test_web -v
  15 passed
node --test test_graph.mjs test_location.mjs
  12 passed
```

Ngoài 31 hàm kiểm thử tự động, đã đối chiếu 24.025 cặp toàn bộ nút:
không có sai lệch khoảng cách giữa A* và Dijkstra. Trong 1.936 cặp địa
điểm, 86 cặp có chuỗi nút khác nhau nhưng cùng chi phí. Mỗi thuật toán
được đo 500 lần trên mỗi tuyến trong 10 tuyến đại diện, sau 30 lần khởi
động; thứ tự chạy được đảo xen kẽ. Xem `measurements.json`,
`measurements.csv` và `reproduce_measurements.py`.

Đã kiểm tra giao diện ở 1440×1000, 768×1024 và 390×844 pixel CSS;
scrollWidth bằng clientWidth ở cả ba trạng thái quan sát. Đã thử tuyến
mẫu, chuyển thuật toán, đặt lại, đầu vào trống, tìm không dấu và trùng điểm.
Ảnh chụp trong `images/` sử dụng dữ liệu mới. Bản Word được kết xuất để
kiểm tra 24 trang, 12 bảng và 2 ảnh minh họa.

Một lượt HTTP từng bị Windows ngắt socket (WinError 10053) ở ca từ chối
origin. Kiểm tra riêng ca đó năm lượt liên tiếp thành công; lượt kiểm thử
HTTP đầy đủ cuối có 15/15 thành công. Không thay đổi cơ chế từ chối origin.

## Giới hạn được giữ rõ trong báo cáo

- GPS được kiểm thử bằng đối tượng mô phỏng; chưa đo độ chính xác thực địa.
- Responsive được kiểm tra bằng khung hình trình duyệt, chưa thay thế thiết bị thật.
- Do trọng số làm tròn, heuristic có một số ước lượng vượt chi phí thật ở
  đoạn rất ngắn, lớn nhất quan sát khoảng 0,025315 m. Chưa phát hiện sai
  khoảng cách trên 24.025 cặp hiện tại; không suy rộng thành bảo đảm cho mọi
  dữ liệu mới. Mã thuật toán được giữ nguyên và cần đối chiếu lại khi thay dữ liệu.
- Những cạnh `needsReview` vẫn đang mở; cần kiểm tra thực địa để nâng độ tin cậy.
