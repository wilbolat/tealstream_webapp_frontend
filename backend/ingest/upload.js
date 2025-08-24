require('dotenv').config();
const multer = require('multer');
const path = require('path');
const max = Number(process.env.MAX_PHOTO_MB||5)*1024*1024;
const storage = multer.memoryStorage();
const upload = multer({
  storage, limits:{ fileSize: max },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype==='image/jpeg' || /\.jpe?g$/i.test(file.originalname||'');
    cb(ok? null : new Error('ONLY_JPEG_ALLOWED'), ok);
  }
});
module.exports = { upload };
