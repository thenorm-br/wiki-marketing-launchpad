-- Criar bucket para áudios de ligação (privado, apenas o usuário acessa sua pasta)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('call-audios', 'call-audios', false, 10485760, ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/x-m4a', 'audio/mp4']);

-- Policy: Usuário pode ver apenas seus próprios áudios
CREATE POLICY "Users can view their own audio files"
ON storage.objects FOR SELECT
USING (bucket_id = 'call-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Usuário pode fazer upload apenas na própria pasta
CREATE POLICY "Users can upload audio to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'call-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Usuário pode atualizar apenas seus próprios áudios
CREATE POLICY "Users can update their own audio files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'call-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Usuário pode deletar apenas seus próprios áudios
CREATE POLICY "Users can delete their own audio files"
ON storage.objects FOR DELETE
USING (bucket_id = 'call-audios' AND auth.uid()::text = (storage.foldername(name))[1]);