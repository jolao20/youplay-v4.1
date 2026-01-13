@echo off
title Servidor YouPlay v2.0 - Status: Ligado
color 0C

echo ==========================================
echo       INICIALIZADOR DO YOUPLAY 2.0
echo ==========================================
echo.

:: Verifica se a pasta node_modules existe, se nao, instala as dependencias
if not exist node_modules (
    echo [AVISO] Bibliotecas nao encontradas. Instalando agora...
    npm install express mongoose bcryptjs jsonwebtoken cors
)

echo [INFO] A ligar ao MongoDB...
echo [INFO] Servidor a iniciar em http://localhost:3000
echo.
echo ------------------------------------------
echo Pressione CTRL+C para desligar o servidor.
echo ------------------------------------------
echo.

:: Inicia o servidor
node server.js

pause