const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const SECRET_KEY = "youplay_ultra_secret_123"; // Mantenha em segredo

// --- CONFIGURAÇÕES ---
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

let publicPath = path.join(__dirname); 
if (!fs.existsSync(path.join(publicPath, 'youplay.html'))) publicPath = path.join(__dirname, '..');
app.use(express.static(publicPath));

const tempDir = path.join('/tmp', 'uploads');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// 1. CONFIGURAÇÕES CLOUD
cloudinary.config({
  cloud_name: 'dxde6cujp', api_key: '697358479556985', api_secret: 'DE3xK3YOEUGVKGjfjzdmoIfEkLs', secure: true
});

mongoose.connect("mongodb+srv://Admin:youplay123@cluster0.xemsano.mongodb.net/youplay_v4?retryWrites=true&w=majority")
    .then(() => console.log("✅ DB Conectada"));

// 2. MODELOS
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    channelName: String
}));

const Video = mongoose.model('Video', new mongoose.Schema({
    title: String, url: String, thumbnail: String, author: String, date: { type: Date, default: Date.now }
}));

const upload = multer({ storage: multer.diskStorage({
    destination: (req, file, cb) => { cb(null, tempDir); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
})});

// --- 3. ROTAS DE AUTENTICAÇÃO ---
app.post('/auth/register', async (req, res) => {
    try {
        const { username, password, channelName } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword, channelName });
        res.status(201).json({ message: "Canal criado!" });
    } catch (e) { res.status(400).json({ error: "Utilizador já existe" }); }
});

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ userId: user._id, channel: user.channelName }, SECRET_KEY);
        res.json({ token, channel: user.channelName });
    } else { res.status(401).json({ error: "Dados inválidos" }); }
});

// --- 4. ROTAS DE VÍDEO ---
app.get('/videos', async (req, res) => {
    const videos = await Video.find().sort({ date: -1 });
    res.json(videos);
});

app.post('/videos', upload.single('video'), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, { resource_type: "video", folder: "youplay_v4" });
        const video = await Video.create({
            title: req.body.title || req.file.originalname,
            thumbnail: req.body.thumbnail,
            url: result.secure_url,
            author: req.body.author || "Anónimo"
        });
        fs.unlinkSync(req.file.path);
        res.status(201).json(video);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/videos/:id', async (req, res) => {
    const video = await Video.findById(req.params.id);
    const publicId = "youplay_v4/" + video.url.split('/').pop().split('.')[0];
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    await Video.findByIdAndDelete(req.params.id);
    res.json({ message: "Eliminado!" });
});

app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'youplay.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 YouPlay 6.0 na porta ${PORT}`));