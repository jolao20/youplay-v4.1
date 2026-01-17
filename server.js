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
const SECRET_KEY = "youplay_ultra_secret_7.0"; // Chave para os Tokens JWT

// --- 1. CONFIGURAÇÕES GERAIS ---
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Lógica para servir o HTML (Resolve o erro 404 no Render)
let publicPath = path.join(__dirname); 
if (!fs.existsSync(path.join(publicPath, 'youplay.html'))) {
    publicPath = path.join(__dirname, '..');
}
app.use(express.static(publicPath));

// Pasta temporária para uploads (Compatível com o Render)
const tempDir = path.join('/tmp', 'uploads');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// --- 2. CONFIGURAÇÕES CLOUD (MongoDB & Cloudinary) ---
cloudinary.config({
  cloud_name: 'dxde6cujp',
  api_key: '697358479556985',
  api_secret: 'DE3xK3YOEUGVKGjfjzdmoIfEkLs',
  secure: true
});

mongoose.connect("mongodb+srv://Admin:youplay123@cluster0.xemsano.mongodb.net/youplay_v4?retryWrites=true&w=majority")
    .then(() => console.log("✅ YouPlay 7.0: Base de Dados Conectada"))
    .catch(err => console.error("❌ Erro Mongo:", err));

// --- 3. MODELOS DE DADOS ---
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    channelName: String
}));

const Video = mongoose.model('Video', new mongoose.Schema({
    title: String,
    url: String, 
    thumbnail: String,
    author: String,
    isShort: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
}));

// Configuração do Multer (Upload Temporário)
const upload = multer({ storage: multer.diskStorage({
    destination: (req, file, cb) => { cb(null, tempDir); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
})});

// --- 4. ROTAS DE AUTENTICAÇÃO (Login e Registo) ---
app.post('/auth/register', async (req, res) => {
    try {
        const { username, password, channelName } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword, channelName });
        res.status(201).json({ message: "Canal criado com sucesso!" });
    } catch (e) {
        res.status(400).json({ error: "Este nome de utilizador já existe." });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ userId: user._id, channel: user.channelName }, SECRET_KEY);
            res.json({ token, channel: user.channelName });
        } else {
            res.status(401).json({ error: "Utilizador ou senha incorretos." });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 5. ROTAS DE VÍDEO (Upload, Listagem, Eliminação) ---

// Listar todos os vídeos (Normal + Shorts)
app.get('/videos', async (req, res) => {
    try {
        const videos = await Video.find().sort({ date: -1 });
        res.json(videos);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Upload Híbrido (Identifica se é Short via req.body)
app.post('/videos', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro enviado" });

        // Envia para o Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: "video",
            folder: "youplay_v4"
        });

        // Cria o registo no MongoDB
        const video = await Video.create({
            title: req.body.title || req.file.originalname,
            thumbnail: req.body.thumbnail,
            url: result.secure_url,
            author: req.body.author || "Anónimo",
            isShort: req.body.isShort === 'true' // Importante para a v7.0
        });

        fs.unlinkSync(req.file.path); // Apaga o ficheiro temporário do servidor
        res.status(201).json(video);
    } catch (e) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message });
    }
});

// Eliminar Vídeo
app.delete('/videos/:id', async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ error: "Vídeo não encontrado" });

        // Eliminar do Cloudinary
        const publicId = "youplay_v4/" + video.url.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });

        // Eliminar do MongoDB
        await Video.findByIdAndDelete(req.params.id);
        res.json({ message: "Vídeo removido da nuvem!" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Rota Principal para servir o HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'youplay.html'));
});

// --- 6. INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`==========================================`);
    console.log(`🚀 YOUPLAY 7.0 - ONLINE 24H`);
    console.log(`📡 Endereço Local: http://localhost:${PORT}`);
    console.log(`🌍 Cloud: ${process.env.RENDER_EXTERNAL_URL || 'A aguardar link...'}`);
    console.log(`==========================================`);
});