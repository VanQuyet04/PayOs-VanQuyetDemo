require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const { generateSignatureFromData } = require('./coreSignatureUtils.js');

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
            cancelUrl: 'http://localhost:3000/cancel',
            returnUrl: 'http://localhost:3000/success',
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

    // Gửi file HTML thông báo thành công
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Thanh toán thành công</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f0f0f0;
                }
                .container {
                    text-align: center;
                    padding: 20px;
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .success-icon {
                    color: #4CAF50;
                    font-size: 48px;
                    margin-bottom: 20px;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    background-color: #4CAF50;
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">✓</div>
                <h1>Thanh toán thành công!</h1>
                <p>Mã đơn hàng: ${orderCode}</p>
                <p>Trạng thái: ${status}</p>
                <a href="/" class="button">Quay lại trang chủ</a>
            </div>
        </body>
        </html>
    `);
});

// Route xử lý khi hủy thanh toán
app.get('/cancel', (req, res) => {
    const { orderCode } = req.query;
    console.log('Payment cancelled:', { orderCode });

    // Gửi file HTML thông báo hủy
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Hủy thanh toán</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f0f0f0;
                }
                .container {
                    text-align: center;
                    padding: 20px;
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .cancel-icon {
                    color: #f44336;
                    font-size: 48px;
                    margin-bottom: 20px;
                }
                .button {
                    display: inline-block;
                    padding: 10px 20px;
                    background-color: #f44336;
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="cancel-icon">✕</div>
                <h1>Đã hủy thanh toán</h1>
                <p>Mã đơn hàng: ${orderCode}</p>
                <a href="/" class="button">Quay lại trang chủ</a>
            </div>
        </body>
        </html>
    `);
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


//---------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 