-- Create sessions table for managing coding sessions
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL UNIQUE,
  code_content TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (anyone can read/write to any session)
CREATE POLICY "Anyone can view sessions"
ON public.sessions
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create sessions"
ON public.sessions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update sessions"
ON public.sessions
FOR UPDATE
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sessions_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;

-- Create signaling table for WebRTC
CREATE TABLE public.webrtc_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL,
  from_peer TEXT NOT NULL,
  to_peer TEXT,
  signal_type TEXT NOT NULL,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security for signals
ALTER TABLE public.webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Create policies for signals
CREATE POLICY "Anyone can view signals"
ON public.webrtc_signals
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create signals"
ON public.webrtc_signals
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can delete signals"
ON public.webrtc_signals
FOR DELETE
USING (true);

-- Enable realtime for signals table
ALTER PUBLICATION supabase_realtime ADD TABLE public.webrtc_signals;