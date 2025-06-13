# Demo Thanh Toán PayOS

Đây là một ứng dụng demo tích hợp thanh toán PayOS sử dụng Node.js và Express.

## Cài đặt

1. Clone repository này
2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file `.env` với các thông tin sau:
```
PAYOS_CLIENT_ID=your_client_id
PAYOS_API_KEY=your_api_key
PAYOS_CHECKSUM_KEY=your_checksum_key
PORT=3000
```

## Chạy ứng dụng

```bash
node index.js
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

## Cách sử dụng

1. Truy cập `http://localhost:3000`
2. Nhập số tiền và mô tả thanh toán
3. Nhấn nút "Thanh toán"
4. Bạn sẽ được chuyển hướng đến trang thanh toán của PayOS

## API Endpoints

- `POST /create-payment`: Tạo URL thanh toán mới
  - Body: `{ amount: number, description: string, orderCode: string }`
  - Response: `{ checkoutUrl: string }`

- `POST /webhook`: Endpoint nhận webhook từ PayOS
  - Headers: `x-payos-signature`
  - Body: Webhook data từ PayOS

## Lưu ý

- Đảm bảo bạn đã đăng ký tài khoản PayOS và có đầy đủ thông tin Client ID, API Key và Checksum Key
- Trong môi trường production, bạn nên thay đổi các URL callback (returnUrl, cancelUrl) thành domain thực tế của bạn
- Nên thêm xử lý lỗi và validation kỹ hơn trong môi trường production 