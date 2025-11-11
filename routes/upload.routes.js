import express from 'express';
import {
  uploadImage,
  uploadImages,
  uploadUserAvatar,
  deleteImage,
} from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { upload } from '../utils/cloudinary.js';
import { uploadLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

// All upload routes are protected
router.use(protect);
router.use(uploadLimiter);

router.post('/image', upload.single('image'), uploadImage);
router.post('/images', upload.array('images', 10), uploadImages);
router.post('/avatar', upload.single('avatar'), uploadUserAvatar);
router.delete('/image', deleteImage);

export default router;