import crypto from 'crypto';

// Hàm sắp xếp object theo key alphabet
function sortObjectByKey(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = obj[key];
      return sorted;
    }, {});
}

// Chuyển object thành chuỗi key=value&key=value
function convertObjectToQueryString(obj) {
  return Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .map((key) => {
      let value = obj[key];

      // Nếu là mảng, sắp xếp từng object trong mảng
      if (Array.isArray(value)) {
        value = JSON.stringify(value.map(sortObjectByKey));
      }

      // Nếu là null hoặc undefined, gán chuỗi rỗng
      if ([null, undefined, 'null', 'undefined'].includes(value)) {
        value = '';
      }

      return `${key}=${value}`;
    })
    .join('&');
}

// Hàm core tạo chữ ký
export function generateSignatureFromData(data, checksumKey) {
  if (!checksumKey) throw new Error('Checksum key is required');

  const sortedData = sortObjectByKey(data);
  const queryStr = convertObjectToQueryString(sortedData);

  return crypto.createHmac('sha256', checksumKey).update(queryStr).digest('hex');
}
