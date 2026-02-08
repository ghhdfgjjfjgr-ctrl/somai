const linkInput = document.getElementById('share-link');
const startButton = document.getElementById('start-record');
const stopButton = document.getElementById('stop-record');
const statusText = document.getElementById('status-text');
const preview = document.getElementById('preview');
const downloadLink = document.getElementById('download-link');

let mediaRecorder;
let recordedChunks = [];

const setStatus = (text) => {
  statusText.textContent = text;
};

const normalizeUrl = (value) => {
  const url = value.trim();
  if (!url) {
    return '';
  }
  return url;
};

startButton.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    return;
  }

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setStatus(
        'ไม่สามารถเริ่มอัดเสียงได้: เบราว์เซอร์นี้ไม่รองรับการแชร์หน้าจอ (ใช้ HTTPS/localhost และ Chrome/Edge)'
      );
      return;
    }

    const url = normalizeUrl(linkInput.value);
    if (!url) {
      setStatus('โปรดใส่ลิงก์เพลงก่อนเริ่มอัดเสียง');
      return;
    }

    window.open(url, '_blank', 'noopener');
    setStatus('เปิดลิงก์แล้ว กำลังขอสิทธิ์แชร์เสียงจากแท็บ...');
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });

    recordedChunks = [];
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      uploadRecording();
    };

    mediaRecorder.start();
    startButton.disabled = true;
    stopButton.disabled = false;
    setStatus('กำลังอัดเสียงอยู่...');
  } catch (error) {
    setStatus(`ไม่สามารถเริ่มอัดเสียงได้: ${error.message}`);
  }
});

stopButton.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    stopButton.disabled = true;
    setStatus('กำลังอัปโหลดและแปลงไฟล์เป็น MP4...');
  }
});

const uploadRecording = async () => {
  try {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const formData = new FormData();
    formData.append('recording', blob, 'recording.webm');

    const response = await fetch('/api/convert', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'แปลงไฟล์ไม่สำเร็จ');
    }

    const mp4Blob = await response.blob();
    const url = URL.createObjectURL(mp4Blob);

    preview.src = url;
    downloadLink.href = url;
    downloadLink.classList.add('visible');
    setStatus('แปลงไฟล์เสร็จแล้ว สามารถดาวน์โหลดได้');
  } catch (error) {
    setStatus(`เกิดข้อผิดพลาด: ${error.message}`);
  } finally {
    startButton.disabled = false;
    stopButton.disabled = true;
  }
};
