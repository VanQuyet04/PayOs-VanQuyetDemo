require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const { generateSignatureFromData } = require('./utils/coreSignatureUtils');

// Lấy SERVER_URL từ biến môi trường
const SERVER_URL = process.env.SERVER_URL;

// Kiểm tra biến môi trường bắt buộc
if (!SERVER_URL) {
    console.error('❌ Thiếu biến môi trường bắt buộc: SERVER_URL');
    process.exit(1);
}

// Tạo các URL từ SERVER_URL
const RETURN_URL = `${SERVER_URL}/success`;
const CANCEL_URL = `${SERVER_URL}/cancel`;

// tạo signature để tạo đơn
function createSignatureForPaymentRequest(data, checksumKey) {
    const requiredFields = {
        amount: data.amount,
        cancelUrl: data.cancelUrl,
        description: data.description,
        orderCode: data.orderCode,
        returnUrl: data.returnUrl,
    };

    return generateSignatureFromData(requiredFields, checksumKey);
}

// kiểm tra signature trả về qua webhook
function createSignatureForWebhook(data, checksumKey) {
    return generateSignatureFromData(data, checksumKey);
}

// Route tạo đơn thanh toán
app.post('/create-payment', async (req, res) => {
    try {
        const { amount, description, orderCode } = req.body;

        // Validate input
        if (!amount || amount < 1000) {
            return res.status(400).json({
                error: 'Invalid amount',
                message: 'Amount must be at least 1,000 VND'
            });
        }

        if (!description || description.trim().length === 0) {
            return res.status(400).json({
                error: 'Invalid description',
                message: 'Description is required'
            });
        }

        // Validate orderCode
        if (!orderCode || typeof orderCode !== 'number' || orderCode <= 0 || orderCode > 9007199254740991) {
            return res.status(400).json({
                error: 'Invalid order code',
                message: 'Order code must be a positive number not exceeding 9007199254740991'
            });
        }

        // Validate environment variables
        if (!process.env.PAYOS_CLIENT_ID || !process.env.PAYOS_API_KEY || !process.env.PAYOS_CHECKSUM_KEY) {
            return res.status(500).json({
                error: 'Configuration error',
                message: 'PayOS credentials are not properly configured'
            });
        }

        console.log('Payment request data:', {
            amount,
            description,
            orderCode
        });

        const paymentData = {
            orderCode,
            amount,
            description,
            cancelUrl: CANCEL_URL,
            returnUrl: RETURN_URL,
            expiredAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour
            signature: ''
        };

        console.log('Payment data before signature:', paymentData);

        paymentData.signature = createSignatureForPaymentRequest(paymentData, process.env.PAYOS_CHECKSUM_KEY);

        console.log('Payment data after signature:', paymentData);

        const response = await axios.post(
            'https://api-merchant.payos.vn/v2/payment-requests',
            paymentData,
            {
                headers: {
                    'x-client-id': process.env.PAYOS_CLIENT_ID,
                    'x-api-key': process.env.PAYOS_API_KEY,
                }
            }
        );

        console.log('PayOS API response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error creating payment:');
        console.error('Error message:', error.message);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        console.error('Error headers:', error.response?.headers);

        res.status(500).json({
            error: 'Failed to create payment',
            details: error.response?.data || error.message
        });
    }
});

// Route xử lý khi thanh toán thành công
app.get('/success', (req, res) => {
    const { orderCode, status } = req.query;
    console.log('Payment success:', { orderCode, status });
    res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// Route xử lý khi hủy thanh toán
app.get('/cancel', (req, res) => {
    const { orderCode } = req.query;
    console.log('Payment cancelled:', { orderCode });
    res.sendFile(path.join(__dirname, 'public', 'cancel.html'));
});

// Route xử lí khi nhận được request từ payos
app.post('/webhook', (req, res) => {
    const { data, signature } = req.body;

    console.log('📥 Webhook received data:', data);

    const calculatedSignature = createSignatureForWebhook(data, process.env.PAYOS_CHECKSUM_KEY);

    if (signature === calculatedSignature) {
        const { orderCode, paymentLinkId, amount } = data;
        const status = data.status || data.desc || 'UNKNOWN'; // fallback nếu không có status

        console.log('✅ Payment status updated:', { orderCode, paymentLinkId, status, amount });

        // TODO: xử lý lưu DB, gửi email, v.v.
        res.status(200).json({ message: 'Webhook processed successfully' });
    } else {
        console.error('❌ Invalid webhook signature');
        res.status(400).json({ error: 'Invalid signature' });
    }
});

// Route lấy thông tin đơn hàng
app.get('/get-order/:orderCode', async (req, res) => {
    try {
        const { orderCode } = req.params;

        // Validate orderCode
        if (!orderCode) {
            return res.status(400).json({
                code: "01",
                desc: "Invalid order code",
                data: null
            });
        }

        // Validate environment variables
        if (!process.env.PAYOS_CLIENT_ID || !process.env.PAYOS_API_KEY) {
            return res.status(500).json({
                code: "01",
                desc: "PayOS credentials are not properly configured",
                data: null
            });
        }

        const response = await axios.get(
            `https://api-merchant.payos.vn/v2/payment-requests/${orderCode}`,
            {
                headers: {
                    'x-client-id': process.env.PAYOS_CLIENT_ID,
                    'x-api-key': process.env.PAYOS_API_KEY,
                }
            }
        );

        console.log('PayOS API response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error getting order info:');
        console.error('Error message:', error.message);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);

        // Trả về lỗi theo format của PayOS
        res.status(error.response?.status || 500).json({
            code: error.response?.data?.code || "01",
            desc: error.response?.data?.desc || "Failed to get order info",
            data: null
        });
    }
});


//---------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 

// Giữ server Render luôn "thức" (Prevent Sleep)
if (SERVER_URL) {
    setInterval(() => {
        axios.get(SERVER_URL)
            .then(() => console.log(`[PING] ✅ Server đã tự ping lúc ${new Date().toLocaleTimeString()}`))
            .catch(err => console.error('[PING] ❌ Lỗi khi ping:', err.message));
    }, 30000); // mỗi 30 giây
}