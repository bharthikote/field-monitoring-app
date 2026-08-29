import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'visit-photos';

// Uploads a photo buffer (from a multer file) to Supabase Storage and
// returns its public URL. Server-side only - the service_role key this
// uses must never reach the mobile app.
export async function uploadPhoto(buffer, originalName, mimetype) {
  const ext = originalName?.includes('.') ? originalName.split('.').pop() : 'jpg';
  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimetype || 'application/octet-stream',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
