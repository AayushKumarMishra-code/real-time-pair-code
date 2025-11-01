-- Create session_files table for multi-file support
CREATE TABLE public.session_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_content TEXT DEFAULT '',
  language TEXT DEFAULT 'javascript',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_code, filename)
);

-- Enable Row Level Security
ALTER TABLE public.session_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_files (matching sessions table for now)
CREATE POLICY "Anyone can view session files"
ON public.session_files FOR SELECT
USING (true);

CREATE POLICY "Anyone can create session files"
ON public.session_files FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update session files"
ON public.session_files FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete session files"
ON public.session_files FOR DELETE
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_session_files_updated_at
BEFORE UPDATE ON public.session_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for session_files table
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_files;