const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// --- CONFIGURAÇÕES ---
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// LÓGICA DE CAMINHO PARA O HTML (Resolve o erro 404 no Render)
// Verifica se o HTML está na mesma pasta ou uma pasta acima
let publicPath = path.join(__dirname); 
if (!fs.existsSync(path.join(publicPath, 'youplay.html'))) {
    publicPath = path.join(__dirname, '..');
}

app.use(express.static(publicPath));

// Pasta temporária segura para Cloud (Render/Linux)
const tempDir = path.join('/tmp', 'uploads');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// 1. CONFIGURAÇÃO CLOUDINARY
cloudinary.config({
  cloud_name: 'dxde6cujp',
  api_key: '697358479556985',
  api_secret: 'DE3xK3YOEUGVKGjfjzdmoIfEkLs',
  secure: true
});

// 2. STORAGE MULTER
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, tempDir); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

// 3. CONEXÃO MONGODB
const mongoURI = "mongodb+srv://Admin:youplay123@cluster0.xemsano.mongodb.net/youplay_v4?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("✅ MongoDB Conectado"));

const Video = mongoose.model('Video', new mongoose.Schema({
    title: String,
    url: String, 
    thumbnail: String,
    date: { type: Date, default: Date.now }
}));

// --- ROTAS ---

// Rota principal: Serve o HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'youplay.html'));
});

// Listar vídeos
app.get('/videos', async (req, res) => {
    const videos = await Video.find().sort({ date: -1 });
    res.json(videos);
});

// Upload
app.post('/videos', upload.single('video'), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: "video",
            folder: "youplay_v4"
        });
        const video = await Video.create({
            title: req.body.title || req.file.originalname,
            thumbnail: req.body.thumbnail,
            url: result.secure_url 
        });
        fs.unlinkSync(req.file.path);
        res.status(201).json(video);
    } catch (e) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message });
    }
});

// Eliminar
app.delete('/videos/:id', async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        const parts = video.url.split('/');
        const publicId = "youplay_v4/" + parts[parts.length - 1].split('.')[0];
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
        await Video.findByIdAndDelete(req.params.id);
        res.json({ message: "Eliminado!" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PORTA DINÂMICA
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));