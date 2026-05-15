// src/routes/upload.js
// Subida de imágenes al servidor — guarda en /uploads y devuelve la URL pública
const router  = require('express').Router()
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const { requireAuth } = require('../middleware/auth')

// Carpeta donde se guardan las imágenes
const UPLOADS_DIR = path.join(__dirname, '../../public/uploads')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    cb(null, name)
  },
})

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
  const ext = path.extname(file.originalname).toLowerCase()
  if (allowed.includes(ext)) cb(null, true)
  else cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif)'))
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
})

// POST /api/upload/image  (admin)
router.post('/image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' })

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`
  const url = `${baseUrl}/uploads/${req.file.filename}`

  return res.json({ url, filename: req.file.filename })
})

// Manejo de error de multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message })
  }
  next(err)
})

module.exports = router
