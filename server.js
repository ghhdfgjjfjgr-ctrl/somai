const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 500 }
});

app.post('/api/convert', upload.single('recording'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัปโหลด' });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aimusic-recorder-'));
  const inputPath = path.join(tempDir, 'input.webm');
  const outputPath = path.join(tempDir, 'output.mp4');

  try {
    fs.writeFileSync(inputPath, req.file.buffer);

    const ffmpegArgs = [
      '-y',
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({
          error: 'ไม่สามารถแปลงไฟล์เป็น MP4 ได้',
          detail: stderr
        });
      }

      const fileStream = fs.createReadStream(outputPath);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="aimusic-recording.mp4"');
      fileStream.pipe(res);

      fileStream.on('close', () => {
        fs.rmSync(tempDir, { recursive: true, force: true });
      });
    });
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์', detail: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
