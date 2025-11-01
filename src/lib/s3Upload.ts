// src/lib/s3Upload.ts
import { BACKEND_URL } from '../config';

export async function getPresign(filename: string, contentType = 'image/jpeg') {
  const url = `${BACKEND_URL}/presign?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Presign request failed');
  return resp.json(); // { url, key, bucket }
}

export async function uploadToS3Presigned(presignUrl: string, uri: string, contentType = 'image/jpeg') {
  // fetch file bytes as blob
  const response = await fetch(uri);
  const blob = await response.blob();

  const putResp = await fetch(presignUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: blob
  });

  if (!putResp.ok) {
    const text = await putResp.text();
    throw new Error(`S3 upload failed: ${putResp.status} ${text}`);
  }

  return true;
}

export async function notifyBackend(key: string, patientId?: string, patientName?: string) {
  const resp = await fetch(`${BACKEND_URL}/notify-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, patientId, patientName })
  });
  if (!resp.ok) {
    const j = await resp.json().catch(()=>null);
    throw new Error(j?.message || 'notify failed');
  }
  return resp.json();
}
